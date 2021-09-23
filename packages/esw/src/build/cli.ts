import arg from 'arg'
import {
  tap,
  map,
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
import { BuildFailure, BuildOptions, Metafile } from 'esbuild'
import {
  isDef,
  serializeSize,
  printTable,
  printBuildError,
  stdout,
  ExitCode
} from '@eswjs/common'
import { CommandRunner } from '../cli/dispatch'
import { resolveArgv } from '../common/argv'
import { isFulfillResult, writeToDiskSync } from '../common/utils'
import { BuildArgsSpec, BUILD_ARGS_SPEC } from './cli-spec'
import { Build } from './node'

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

const build: CommandRunner<ExitCode> = function (argv = []) {
  const handlePrintUsage$ = resolveArgv(
    argv,
    BUILD_ARGS_SPEC,
    createPrintUsage$()
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
        if (isDef(value)) {
          const name = key.replace(/^-+/, '') as keyof BuildOptions
          // @ts-expect-error mixed types
          options[name] = value as BuildOptions[keyof BuildOptions]
        }
        return options
      }, {} as BuildOptions)
    )
  )

  let build: Build
  const handleBuilding$ = normalizedBuildArgs$.pipe(
    mergeMap(options => {
      build = new Build(options)
      return build.run()
    }),
    mergeMap(allResults => from(allResults)),
    share()
  )
  const [handleBuildResult$, handleExceptionResult$] = partition(
    handleBuilding$,
    isFulfillResult
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
        const destinationPath = build?.pathsMap
          ?.get(outPath)
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

        void writeToDiskSync(destination, contents)
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
