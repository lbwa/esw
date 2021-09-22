import path from 'path'
import arg from 'arg'
import {
  EMPTY,
  from,
  of,
  throwError,
  zip,
  tap,
  map,
  catchError,
  Observable,
  concatMap,
  switchMap
} from 'rxjs'
import { PackageJson } from 'type-fest'
import { stdout, ExitCode } from '@eswjs/common'

export type CommandRunner<V = unknown> = (argv?: string[]) => Observable<V>
type Commands = typeof AVAILABLE_COMMANDS
type CommandNames = keyof Commands

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkgJson = require(path.resolve(
  __dirname,
  '../..',
  'package.json'
)) as PackageJson
const AVAILABLE_COMMANDS = {
  build: () => from(import('../build/cli')).pipe(map(({ default: run }) => run))
}
const availableArgs = {
  '--version': Boolean,
  '--help': Boolean,

  // alias
  '-v': '--version',
  '-h': '--help'
}

function printUsageIntoTerminal(commands: Commands) {
  const names = Object.keys(commands)
  stdout.raw(
    `
Usage
  $ esw <command>

Available commands
  ${names.join(', ')}

Options
  --version, -v      Show version number
  --help, -h         Display help messages

For more information run a command with the --help flag
  $ esw ${names[0] ?? ''} --help

`,
    ExitCode.OK
  )
}

/**
 * @example parse(process.argv.slice(2)).subscribe({ next: handleArgs })
 */
export default function parse(argv: string[]) {
  const argv$ = of(argv)
  const resolvedArgv$ = argv$.pipe(
    map(argv =>
      arg(availableArgs, {
        //https://github.com/vercel/arg/blob/5.0.0/index.js#L13
        argv,
        permissive: true
      })
    ),
    catchError((err: Error & { code: string }) => {
      if (err.code === 'ARG_UNKNOWN_OPTION') {
        printUsageIntoTerminal(AVAILABLE_COMMANDS)
        return EMPTY
      }
      return throwError(() => err)
    })
  )

  const handlePrintVersion$ = resolvedArgv$.pipe(
    switchMap(args => {
      if (args['--version']) {
        stdout.raw(`v${pkgJson.version}\n`, ExitCode.OK)
        return EMPTY
      }
      return of(args)
    })
  )

  const handlePrintUsage$ = handlePrintVersion$.pipe(
    concatMap(args => {
      const { _: [commandStdin] = [] } = args
      const isValidStdin = !!AVAILABLE_COMMANDS[commandStdin as CommandNames]
      if (isValidStdin) {
        return of({ isValidStdin, args })
      }

      /**
       * 1. not a valid stdin,
       * 2. with a global help flag
       */
      printUsageIntoTerminal(AVAILABLE_COMMANDS)
      return EMPTY
    })
  )

  const handleForwardArgs$ = handlePrintUsage$.pipe(
    map(({ isValidStdin, args }) => {
      const commandName = args._[0]
      const forwardArgs = isValidStdin ? args._.slice(1) : args._
      if (args['--help']) {
        forwardArgs.push('--help')
      }
      return {
        forwardArgs,
        commandName
      }
    })
  )

  const setEnvVariables$ = handleForwardArgs$.pipe(
    tap(({ commandName }) => {
      const normalizedEnv =
        commandName === 'build' ? 'production' : 'development'
      process.env['NODE_ENV'] ||= normalizedEnv

      // Make sure commands gracefully respect termination signals (e.g. from Docker)
      process.on('SIGTERM', () => process.exit(ExitCode.OK))
      process.on('SIGINT', () => process.exit(ExitCode.OK))
    })
  )

  const handleCommandStdin$ = setEnvVariables$.pipe(
    concatMap(({ commandName, forwardArgs }) =>
      zip(
        from(AVAILABLE_COMMANDS[commandName as CommandNames]()),
        of(forwardArgs)
      )
    ),
    concatMap(([run, args]) => run?.(args))
  )

  return handleCommandStdin$
}
