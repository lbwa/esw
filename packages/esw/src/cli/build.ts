import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import arg, { ArgError } from 'arg'
import {
  iif,
  of,
  tap,
  map,
  throwError,
  concatMap,
  from,
  partition,
  share,
  mergeMap,
  reduce,
  defer,
  NEVER
} from 'rxjs'
import omit from 'lodash/omit'
import cloneDeep from 'lodash/cloneDeep'
import { BuildFailure, BuildOptions, BuildResult, Metafile } from 'esbuild'
import {
  isDef,
  serializeSize,
  printTable,
  printBuildError,
  stdout,
  ExitCode
} from '@eswjs/common'
import { CommandRunner } from '../parser/cli'
import runBuild, { outputPathMapping } from '../build'
import { BuildArgsSpec, BUILD_ARGS_SPEC } from '../shared/cli-spec'

function createPrintUsage$(exitCode = ExitCode.OK) {
  return defer(() => {
    stdout.raw(
      `
Description
  Compiles the codebase for publishing npm package.

Usage
  $ esw build [entry files]

  [entry file] represents the library entry point.
  If no entry is provided, the basename from main and module field in package.json will be used.
  User should always specific a entry point explicitly when the main and module have a different basename.

`,
      exitCode,
      false
    )
    return NEVER
  })
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

const build: CommandRunner<ExitCode> = function (argv = []) {
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
              `Unknown arguments: ${unavailable.join(
                ', '
              )}. \nRun 'esw build --help' to print all available arguments.`,
              'ARG_UNKNOWN_OPTION'
            )
        )
      )
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

  const handleBuilding$ = normalizedBuildArgs$.pipe(
    mergeMap(options => runBuild(options)),
    mergeMap(allResults => from(allResults)),
    share()
  )
  const [handleBuildResult$, handleExceptionResult$] = partition(
    handleBuilding$,
    fulfillBuildResultFilter
  )

  handleExceptionResult$
    .pipe(
      tap(({ reason }) => {
        process.exitCode = ExitCode.ERROR
        printBuildError(reason as BuildFailure)
      })
    )
    .subscribe(() => process.exit())

  const builtRecord = new Set<string>()

  const handleWriteOutFiles$ = handleBuildResult$.pipe(
    reduce((metaFiles, { value: buildResult = {} }) => {
      const { outputFiles = [], metafile = {} as Metafile } = buildResult
      outputFiles.forEach(({ path: outPath /* absolute path */, contents }) => {
        const destinationPath = outputPathMapping
          .get(outPath)
          ?.find(item => !builtRecord.has(item))
        if (destinationPath) builtRecord.add(destinationPath)
        const destination = destinationPath ?? /* eg. splitted chunks */ outPath

        const cloned = cloneDeep(metafile)
        if (!outPath.endsWith(destination)) {
          const matchedDest = Object.keys(cloned.outputs).find(file =>
            outPath.endsWith(file)
          )
          if (matchedDest) {
            /**
             * @description re-defined matched dest key in metafile.outputs
             * when we use internal path, instead of esbuild output path
             */
            cloned.outputs[destination] = cloned.outputs[
              matchedDest
            ] as NonNullable<Metafile['outputs'][string]>
            delete cloned.outputs[matchedDest]
          }
        }

        void writeToDisk(destination, contents)
        metaFiles.push(cloned)
      }, [] as string[])
      return metaFiles
    }, [] as Metafile[]),
    map(metaFiles => {
      builtRecord.clear()
      if (metaFiles.length < 1) {
        stdout.warn("The file wasn't created.")
        return ExitCode.ERROR
      }

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
        ]),
        ['', '\n']
      ] as string[][]

      printTable(message)
      return ExitCode.OK
    })
  )

  return handleWriteOutFiles$
}

export default build
