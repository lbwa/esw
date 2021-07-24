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
  pipe,
  mergeMap
} from 'rxjs'
import omit from 'lodash/omit'
import { BuildOptions, BuildResult } from 'esbuild'
import { printAndExit } from '../shared/log'
import { ProcessCode } from '../shared/constants'
import { CommandRunner } from '../parser/cli'
import runBuild from '../build'
import { isDef } from '../shared/utils'
import { BuildArgsSpec, BUILD_ARGS_SPEC } from '../shared/cli-spec'

function createPrintHelp(code = ProcessCode.OK) {
  return of(code).pipe(
    tap(code =>
      printAndExit(
        `
    Description
      Compiles the codebase for package publish

    Usage
      $ esw build <entry files>

    <entry files> represents the library entry points.
`,
        code
      )
    ),
    switchMapTo(EMPTY)
  )
}

function normalizeValidArgs() {
  return pipe(
    map((argv: string[]) => arg(BUILD_ARGS_SPEC, { argv, permissive: true })),
    mergeMap(args => {
      const matched = args._.filter(pending => pending.startsWith('-'))
      return iif(
        () => matched.length > 0,
        throwError(
          () =>
            new ArgError(
              `Unknown or unexpected option: ${matched.join(', ')}`,
              'ARG_UNKNOWN_OPTION'
            )
        ),
        of(args)
      )
    }),
    catchError((err: Error & { code: string }) => {
      if (err.code === 'ARG_UNKNOWN_OPTION') {
        return createPrintHelp(ProcessCode.ERROR).pipe(switchMapTo(EMPTY))
      }
      throw err
    })
  )
}

function normalizeBuildArgs() {
  return pipe(
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
}

const build: CommandRunner<PromiseSettledResult<BuildResult>[]> = function (
  argv = []
) {
  return of(argv).pipe(
    normalizeValidArgs(),
    mergeMap(args => iif(() => !!args['--help'], createPrintHelp(), of(args))),
    normalizeBuildArgs(),
    mergeMap(options => runBuild(options))
  )
}

export default build
