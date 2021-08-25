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
  concatMap
} from 'rxjs'
import { PackageJson } from 'type-fest'
import { printToTerminal } from '../shared/printer'
import { ProcessCode as Code } from '../shared/constants'

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
  build: () => from(import('../cli/build')).pipe(map(({ default: run }) => run))
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
  printToTerminal(
    `
    Usage
      $ esw <command>

      Available commands
        ${names.join(', ')}

      Options
        --version, -v Show version number
        --help, -h Display help messages

      For more information run a command with the --help flag
        $ esw ${names[0] ?? ''} --help
  `,
    Code.OK
  )
}

/**
 * @example parse(process.argv.slice(2)).subscribe({ ... })
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
    tap(args => {
      if (args['--version']) {
        printToTerminal(`v${pkgJson.version}`, Code.OK)
      }
    })
  )

  const handlePrintUsage$ = handlePrintVersion$.pipe(
    concatMap(args => {
      const { _: [commandStdin] = [], '--help': isHelpStdin } = args
      const isValidStdin = !!AVAILABLE_COMMANDS[commandStdin as CommandNames]
      if (!isValidStdin || isHelpStdin) {
        printUsageIntoTerminal(AVAILABLE_COMMANDS)
        return EMPTY
      }
      return of({ isValidStdin, args })
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

      process.on('SIGTERM', () => process.exit(0))
      process.on('SIGINT', () => process.exit(0))
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
