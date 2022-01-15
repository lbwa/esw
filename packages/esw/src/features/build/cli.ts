import arg from 'arg'
import {
  tap,
  map,
  from,
  partition,
  share,
  mergeMap,
  defer,
  NEVER,
  toArray
} from 'rxjs'
import omit from 'lodash/omit'
import { BuildFailure, BuildOptions, Metafile, analyzeMetafile } from 'esbuild'
import { isDef, printBuildError, stdout, ExitCode } from '@eswjs/common'
import { BuildArgsSpec, BUILD_ARGS_SPEC } from './cli-spec'
import { BundleService, inferBuildOptions } from '@bundle/index'
import { CommandRunner } from '@cli/dispatch'
import { resolveArgv } from '@cli/argv'
import { isFulfillResult } from '@utils/data-structure'
import { AvailableCommands } from '@cli/constants'

function createPrintUsage$(exitCode = ExitCode.OK) {
  return defer(() => {
    stdout.raw(
      `
Description
  Compiles the codebase with options inference.

Usage
  esw build [entry] [options]

  [entry] represents the library entry point.
          esw would run options inference when an entry files isn't explicity specified.
          On the other hand, you should always specify a entry point explicitly when the main and module have a different basename.

  [options] esbuild options, see https://esbuild.github.io/

`,
      exitCode,
      false
    )
    return NEVER
  })
}

async function printBuildResultStats(metafiles: Metafile[]) {
  const stringifiedData = await Promise.all(
    metafiles.map(result =>
      analyzeMetafile(result, { color: true, verbose: true })
    )
  )
  stdout.raw(stringifiedData.join('') + `\n`)
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

  let bundleService: BundleService
  const handleBuilding$ = normalizedBuildArgs$.pipe(
    mergeMap(options => {
      bundleService = BundleService.new(
        inferBuildOptions(
          options,
          AvailableCommands.Build,
          options?.absWorkingDir ?? process.cwd()
        )
      )
      return bundleService.build(true)
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

  const handleWriteOutFiles$ = handleBuildResult$.pipe(
    toArray(),
    mergeMap(async buildResult => {
      const metaFiles = buildResult
        .map(({ value }) => value.metafile)
        .filter(Boolean) as Metafile[]
      if (metaFiles.length < 1) {
        stdout.warn('Empty running')
        return ExitCode.ERROR
      }

      await printBuildResultStats(metaFiles)

      return ExitCode.OK
    })
  )

  return handleWriteOutFiles$
}

export default build
