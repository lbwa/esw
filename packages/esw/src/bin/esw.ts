#!/usr/bin/env node
import path from 'path'
import arg from 'arg'
import { from, of, pipe, zip } from 'rxjs'
import { tap, map, concatMap } from 'rxjs/operators'
import { printAndExit } from '../shared/log'

export type CommandRunner = (argv?: string[]) => void

enum Code {
  OK,
  ERROR
}
const DEFAULT_COMMAND_NAME = 'build'
const COMMANDS: Record<string, () => Promise<CommandRunner>> = {
  build: () => import('../cli/build').then(({ default: run }) => run)
}
const args = arg({
  '--version': Boolean,
  '--help': Boolean,

  // alias
  '-v': '--version',
  '-h': '--help'
})
// eslint-disable-next-line
const pkgJson = require(path.resolve(__dirname, '../..', 'package.json'))

function printVersion<V extends { args: typeof args }>(
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

function printHelp<V extends { isValidCommand: boolean; args: typeof args }>(
  commands: typeof COMMANDS
) {
  return pipe(
    tap(({ isValidCommand, args: { '--help': help } }: V) => {
      if (!isValidCommand && help) {
        printAndExit(
          `
          Usage
            $ esw <command>
      
            Available commands
              ${Object.keys(commands).join(', ')}
      
            Options
              --version, -v Show version number
              --help, -h Display help messages
      
            For more information run a command with the --help flag
              $ esw build --help
        `,
          Code.OK
        )
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
  V extends { isValidCommand: boolean; args: typeof args }
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

of(args)
  .pipe(
    map(args => ({ isValidCommand: !!COMMANDS[args._[0]], args })),
    printVersion(pkgJson),
    printHelp(COMMANDS),
    normalizeArgs(DEFAULT_COMMAND_NAME),
    setEnv(),
    invokeCommand()
  )
  .subscribe({
    next() {
      process.exit(Code.OK)
    },
    error(err: Error) {
      printAndExit(err.message, Code.ERROR)
    }
  })
