import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import arg, { ArgError } from 'arg'
import isNil from 'lodash/isNil'
import {
  EMPTY,
  iif,
  of,
  switchMapTo,
  tap,
  map,
  catchError,
  throwError,
  concatMap,
  from,
  partition,
  share,
  mergeMap,
  reduce
} from 'rxjs'
import omit from 'lodash/omit'
import { BuildOptions, BuildResult, Metafile } from 'esbuild'
import { isDef, log, serializeSize, printTable } from '@eswjs/common'
import { printToTerminal } from '../shared/printer'
import { ProcessCode } from '../shared/constants'
import { CommandRunner } from '../parser/cli'
import runBuild, { outputPathMapping } from '../build'
import { BuildArgsSpec, BUILD_ARGS_SPEC } from '../shared/cli-spec'

function createPrintUsage$(code = ProcessCode.OK) {
  return of(code).pipe(
    tap(code =>
      printToTerminal(
        `
    Description
      Compiles the codebase for publishing npm package.

    Usage
      $ esw build [entry files]

      [entry file] represents the library entry point.
      If no entry is provided, the basename from main and module field in package.json will be used.
      User should always specific a entry point explicitly when the main and module have a different basename.

`,
        code,
        false
      )
    ),
    switchMapTo(EMPTY)
  )
}

function fulfillBuildResultFilter(
  result: PromiseSettledResult<BuildResult>
): result is PromiseFulfilledResult<BuildResult> {
  return result.status === 'fulfilled'
}

async function writeToDisk(
  outPath: string,
  content: string | NodeJS.ArrayBufferView
) {
  mkdirSync(path.dirname(outPath), { recursive: true })
  writeFileSync(outPath, content, { encoding: null })
}

const build: CommandRunner<ProcessCode> = function (argv = []) {
  const argv$ = of(argv)
  const resolvedArgv$ = argv$.pipe(
    map(argv => arg(BUILD_ARGS_SPEC, { argv, permissive: true })),
    concatMap(argv => {
      const unavailable = argv._.filter(pending => pending.startsWith('-'))
      return iif(
        () => unavailable.length < 1,
        of(argv),
        throwError(
          () =>
            new ArgError(
              `Unknown or unexpected option: ${unavailable.join(', ')}`,
              // In the current implementation, we only use this error code, instead of above error message.
              'ARG_UNKNOWN_OPTION'
            )
        )
      )
    }),
    catchError((err: Error & { code: string }) => {
      if (err.code === 'ARG_UNKNOWN_OPTION') {
        return createPrintUsage$(ProcessCode.ERROR).pipe(switchMapTo(EMPTY))
      }
      throw err
    })
  )

  const handlePrintUsage$ = resolvedArgv$.pipe(
    concatMap(argv =>
      iif(() => !!argv['--help'], createPrintUsage$(), of(argv))
    )
  )

  const normalizedBuildArgs$ = handlePrintUsage$.pipe(
    map((args: arg.Result<BuildArgsSpec>) => {
      args['--absWorkingDir'] ??= process.cwd()
      const entryPoints = args._.filter(pending => !pending.startsWith('-'))
      args['--entryPoints'] ??= entryPoints.length > 0 ? entryPoints : undefined
      return omit(args, '_')
    }),
    map(args =>
      Object.keys(args).reduce((options, key) => {
        const value = args[key as keyof BuildArgsSpec]
        // we use null to mark illegal command line value
        if (isDef(value)) {
          const name = key.replace(/^-+/, '') as keyof BuildOptions
          // @ts-ignore FIXME
          options[name] = value
        }
        return options
      }, {} as BuildOptions)
    )
  )

  const [handleBuildResult$, handleExceptionResult$] = partition(
    normalizedBuildArgs$.pipe(
      mergeMap(options => runBuild(options)),
      mergeMap(allResults => from(allResults)),
      share()
    ),
    fulfillBuildResultFilter
  )

  handleExceptionResult$
    .pipe(
      tap(({ reason }) => {
        log.error((reason as Error)?.message ?? reason)
        process.exitCode = ProcessCode.ERROR
      })
    )
    .subscribe(() => process.exit())

  const handleWriteOutFiles$ = handleBuildResult$.pipe(
    reduce((metaFiles, { value: buildResult = {} }) => {
      const { outputFiles = [], metafile = {} as Metafile } = buildResult
      const writeable = outputFiles.reduce(
        (writes, { path: outPath, contents }) => {
          const destinationPath = outputPathMapping.get(outPath)
          if (isNil(destinationPath)) {
            log.warn("Couldn't write output files")
            return writes
          }
          writes.push(destinationPath)
          void writeToDisk(destinationPath, contents)
          return writes
        },
        [] as string[]
      )
      return writeable.length > 0 ? metaFiles.concat(metafile) : metaFiles
    }, [] as Metafile[]),
    map(metaFiles => {
      if (metaFiles.length < 1) return ProcessCode.ERROR

      const outputs = metaFiles.reduce(
        (group, { outputs }) => Object.assign(group, outputs),
        {} as Metafile['outputs']
      )

      const message = [
        ['Files', 'Size'],
        ...Object.keys(outputs).map(filename => [
          filename,
          isDef(outputs[filename]?.bytes)
            ? serializeSize(outputs[filename]?.bytes as number)
            : 'unknown'
        ])
      ] as string[][]

      printTable(message)
      return ProcessCode.OK
    })
  )

  return handleWriteOutFiles$
}

export default build
