import path from 'path'
import arg from 'arg'
import {
  EMPTY,
  from,
  of,
  pipe,
  throwError,
  zip,
  tap,
  map,
  concatMap,
  catchError
} from 'rxjs'
import { printAndExit } from './shared/log'
import { ProcessCode as Code } from './shared/constants'

export type CommandRunner = (argv?: string[]) => void
type AvailableArgs = typeof availableArgs
type Commands = typeof COMMANDS

// eslint-disable-next-line
const pkgJson = require(path.resolve(__dirname, '../..', 'package.json'))
const DEFAULT_COMMAND_NAME = 'build'
const COMMANDS: Record<string, () => Promise<CommandRunner>> = {
  build: () => import('./cli/build').then(({ default: run }) => run)
}
const availableArgs = {
  '--version': Boolean,
  '--help': Boolean,

  // alias
  '-v': '--version',
  '-h': '--help'
}

function printVersion<V extends { args: arg.Result<AvailableArgs> }>(
  pkg: Record<string, unknown>
) {
  return pipe(
    tap(({ args }: V) => {
      if (args['--version']) {
        printAndExit(`v${pkg['version'] as string}`, Code.OK)
      }
    })
  )
}

function printHelpIntoTerminal(commands: Commands) {
  const names = Object.keys(commands)
  printAndExit(
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

function printHelp<
  V extends { isValidCommand: boolean; args: arg.Result<AvailableArgs> }
>(commands: Commands) {
  return pipe(
    tap(({ isValidCommand, args: { '--help': help } }: V) => {
      if (!isValidCommand && help) {
        printHelpIntoTerminal(commands)
      }
    })
  )
}

function setEnv<V extends { commandName: string }>() {
  return pipe(
    tap(({ commandName }: V) => {
      const normalizedEnv =
        commandName === 'build' ? 'production' : 'development'
      process.env['NODE_ENV'] ||= normalizedEnv

      process.on('SIGTERM', () => process.exit(0))
      process.on('SIGINT', () => process.exit(0))
    })
  )
}

function normalizeArgs<
  V extends { isValidCommand: boolean; args: arg.Result<AvailableArgs> }
>(defaultCommandName: string) {
  return pipe(
    map(({ isValidCommand, args }: V) => {
      const commandName = isValidCommand ? args._[0] : defaultCommandName
      const forwardArgs = isValidCommand ? args._.slice(1) : args._
      if (args['--help']) {
        forwardArgs.push('--help')
      }
      return {
        forwardArgs,
        commandName
      }
    })
  )
}

function invokeCommand<
  V extends { commandName: string; forwardArgs: string[] }
>() {
  return pipe(
    concatMap(({ commandName, forwardArgs }: V) =>
      zip(from(COMMANDS[commandName]()), of(forwardArgs))
    ),
    map(([run, args]) => run(args))
  )
}

export default of(process.argv.slice(2)).pipe(
  map(argv =>
    arg(availableArgs, {
      //https://github.com/vercel/arg/blob/5.0.0/index.js#L13
      argv,
      permissive: true
    })
  ),
  catchError((err: Error & { code: string }) => {
    if (err.code === 'ARG_UNKNOWN_OPTION') {
      printHelpIntoTerminal(COMMANDS)
      return EMPTY
    }
    return throwError(() => err)
  }),
  map(args => ({ isValidCommand: !!COMMANDS[args._[0]], args })),
  printVersion(pkgJson),
  printHelp(COMMANDS),
  normalizeArgs(DEFAULT_COMMAND_NAME),
  setEnv(),
  invokeCommand()
)
