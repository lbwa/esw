import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import arg, { ArgError } from 'arg'
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
  toArray
} from 'rxjs'
import omit from 'lodash/omit'
import { BuildOptions, BuildResult } from 'esbuild'
import { isDef, log } from '@eswjs/common'
import { printToTerminal } from '../shared/printer'
import { ProcessCode } from '../shared/constants'
import { CommandRunner } from '../parser/cli'
import runBuild from '../build'
import { BuildArgsSpec, BUILD_ARGS_SPEC } from '../shared/cli-spec'

function createUsagePrinter(code = ProcessCode.OK) {
  return of(code).pipe(
    tap(code =>
      printToTerminal(
        `
    Description
      Compiles the codebase for publishing npm package.

    Usage
      $ esw build [entry files]

      [entry file] represents the library entry point. If it wasn't specified,
    esw would infer library entry from 'main' and 'module' field in the package.json.
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
        return createUsagePrinter(ProcessCode.ERROR).pipe(switchMapTo(EMPTY))
      }
      throw err
    })
  )

  const handlePrintUsage$ = resolvedArgv$.pipe(
    concatMap(argv =>
      iif(() => !!argv['--help'], createUsagePrinter(), of(argv))
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
    .pipe(map(({ reason }) => log.error(reason)))
    .subscribe({ complete: () => process.exit(ProcessCode.OK) })

  const handleWriteOutFiles$ = handleBuildResult$.pipe(
    mergeMap(({ value: { outputFiles = [] } = {} }) => from(outputFiles)),
    mergeMap(({ path: outPath, contents }) => writeToDisk(outPath, contents)),
    toArray(),
    map(() => ProcessCode.OK)
  )

  return handleWriteOutFiles$
}

export default build
