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
  catchError,
  Observable,
  mergeMap
} from 'rxjs'
import { PackageJson } from 'type-fest'
import { printAndExit } from '../shared/log'
import { ProcessCode as Code } from '../shared/constants'

export type CommandRunner<V = unknown> = (argv?: string[]) => Observable<V>
type AvailableArgs = typeof availableArgs
type Commands = typeof COMMANDS
type CommandNames = keyof Commands

// eslint-disable-next-line
const pkgJson = require(path.resolve(__dirname, '../..', 'package.json'))
const DEFAULT_COMMAND_NAME = 'build'
const COMMANDS = {
  build: () => from(import('../cli/build')).pipe(map(({ default: run }) => run))
}
const availableArgs = {
  '--version': Boolean,
  '--help': Boolean,

  // alias
  '-v': '--version',
  '-h': '--help'
}

function printVersion<V extends { args: arg.Result<AvailableArgs> }>(
  pkg: PackageJson
) {
  return pipe(
    tap(({ args }: V) => {
      if (args['--version']) {
        printAndExit(`v${pkg.version}`, Code.OK)
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

function printHelp(commands: Commands) {
  return pipe(
    tap(
      ({
        isValidCommand,
        args: { '--help': help }
      }: {
        isValidCommand: boolean
        args: arg.Result<AvailableArgs>
      }) => {
        if (!isValidCommand && help) {
          printHelpIntoTerminal(commands)
        }
      }
    )
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

function parseForwardArgs<
  V extends {
    isValidCommand: boolean
    args: arg.Result<AvailableArgs>
  }
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
  V extends {
    commandName: string
    forwardArgs: string[]
  }
>() {
  return pipe(
    mergeMap(({ commandName, forwardArgs }: V) =>
      zip(from(COMMANDS[commandName as CommandNames]()), of(forwardArgs))
    ),
    mergeMap(([run, args]) => run(args))
  )
}

function parseRootArgs() {
  return pipe(
    map((argv: string[]) =>
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
    })
  )
}

export default of(process.argv.slice(2)).pipe(
  parseRootArgs(),
  map(args => ({
    isValidCommand: !!COMMANDS[args._[0] as CommandNames],
    args
  })),
  printVersion(pkgJson),
  printHelp(COMMANDS),
  parseForwardArgs(DEFAULT_COMMAND_NAME),
  setEnv(),
  invokeCommand()
)
