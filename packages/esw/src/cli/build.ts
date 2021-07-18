import arg, { ArgError } from 'arg'
import {
  EMPTY,
  iif,
  of,
  switchMap,
  switchMapTo,
  tap,
  map,
  catchError,
  throwError,
  pipe,
  from,
  mergeMap
} from 'rxjs'
import omit from 'lodash/omit'
import { BuildOptions, BuildResult } from 'esbuild'
import { printAndExit } from '../shared/log'
import {
  BuildArgsSpec,
  BUILD_ARGS_SPEC,
  ProcessCode
} from '../shared/constants'
import { CommandRunner } from '../cli-parser'
import buildRunner from '../build'
import { isDef } from '../shared/utils'

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

function normalizeArgs() {
  return pipe(
    map((args: arg.Result<BuildArgsSpec>) => {
      args['--absWorkingDir'] ??= process.cwd()
      args['--entryPoints'] ??= args._.filter(
        pending => !pending.startsWith('-')
      )
      return omit(args, '_')
    }),
    map(args =>
      Object.keys(args).reduce((options, key) => {
        const value = args[key as keyof BuildArgsSpec]
        // we use null to mark illegal command line value
        if (isDef(value)) {
          const name = key.replace(/^-+/, '')
          // @ts-ignore FIXME
          options[name as keyof BuildOptions] = value
        }
        return options
      }, {} as BuildOptions)
    )
  )
}

const build: CommandRunner<BuildResult> = function (argv = []) {
  const availableArgs = {
    ...BUILD_ARGS_SPEC,
    '--help': Boolean,

    // alias
    '-h': '--help'
  }

  return of(argv).pipe(
    map(argv => arg(availableArgs, { argv, permissive: true })),
    switchMap(args => {
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
    }),
    switchMap(args => iif(() => !!args['--help'], createPrintHelp(), of(args))),
    normalizeArgs(),
    mergeMap(options => from(buildRunner(options)))
  )
}

export default build
