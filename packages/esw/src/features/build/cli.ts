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
import omitBy from 'lodash/omitBy'
import isNil from 'lodash/isNil'
import { BuildFailure, Metafile, analyzeMetafile } from 'esbuild'
import { printBuildError, stdout, ExitCode } from '@eswjs/common'
import {
  EswBuildOptions,
  EswBuildCommandSpec,
  ESW_BUILD_OPTIONS_SPEC,
  isEswBuildOptionKey
} from './options'
import { BuildService, createBundleService } from '@bundle/index'
import { CommandRunner } from '@cli/dispatch'
import { resolveArgv } from '@cli/argv'
import { isFulfillResult } from '@utils/data-structure'
import { AvailableCommands } from '@cli/constants'
import { dispatchInference } from '@inference/options'
import { Result } from '@cli/parser'

const MSG_BUILD_USAGE = `
Description
  Compiles the codebase with options inference.

Usage
  esw build [entry] [options]

  [entry] represents the library entry point.
          esw would run options inference when an entry point isn't explicitly specified.
          On the other hand, you should always specify an entry point explicitly when the main and module have a different basename.

          Note that a part of inferred options didn't work once we found multiple entry points.

  [options] esbuild options, see https://esbuild.github.io/

`

function createPrintUsage$(exitCode = ExitCode.OK) {
  return defer(() => {
    stdout.raw(MSG_BUILD_USAGE, exitCode, false)
    return NEVER
  })
}

async function printBuildResultStats(metafiles: Metafile[]) {
  const stringifiedData = await Promise.all(
    metafiles.map(metafile =>
      analyzeMetafile(metafile, { color: true, verbose: true })
    )
  )
  stdout.raw(stringifiedData.join('') + `\n`)
}

const build: CommandRunner<ExitCode> = function (argv = []) {
  const handlePrintUsage$ = resolveArgv(
    argv,
    ESW_BUILD_OPTIONS_SPEC,
    createPrintUsage$()
  )

  const normalizedBuildArgs$ = handlePrintUsage$.pipe(
    map((args: Result<EswBuildCommandSpec>) => {
      const entryPoints = args._.filter(pending => !pending.startsWith('-'))
      args['--entryPoints'] ??= entryPoints.length > 0 ? entryPoints : undefined
      args['--absWorkingDir'] ??= process.cwd()
      return omit(args, '_') // FIXME: this line omit unknown esbuild options, TODO: implement esbuild cli args parser
    }),
    map(
      args =>
        omitBy(
          Object.entries(args).reduce((serialized, [key, value]) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            serialized[key.replace(/^-+/, '') as keyof EswBuildOptions] = value
            return serialized
          }, {} as EswBuildOptions),
          isNil
        ) as EswBuildOptions
    )
  )

  let bundleService: BuildService
  const handleBuilding$ = normalizedBuildArgs$.pipe(
    mergeMap(options => {
      const buildOptions = omitBy(options, (_, key) => isEswBuildOptionKey(key))
      const { absWorkingDir: cwd } = buildOptions
      bundleService = createBundleService(
        dispatchInference(buildOptions, AvailableCommands.Build, cwd)
      )
      return bundleService.build(options?.clearBeforeBuild)
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
