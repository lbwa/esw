/* eslint-disable no-console */
import chalk from './chalk'
import { ExitCode } from './const'
import { isWindows } from '.'

/**
 * @see https://github.com/facebook/create-react-app/blob/v4.0.3/packages/react-dev-utils/clearConsole.js
 */
const CLEAR_SCREEN = isWindows ? '\x1B[2J\x1B[0f' : '\x1B[2J\x1B[3J\x1B[H'

export const colors = chalk

export function wait(...message: string[]): void {
  console.log(chalk.bgCyan.black(' WAIT '), ...message)
}

export function error(...message: string[]) {
  console.error(chalk.bgRed.black(' ERROR '), ...message)
}

export function warn(...message: string[]) {
  console.warn(chalk.bgYellow.black(' WARN '), ...message)
}

export function info(...message: string[]) {
  console.info(chalk.bgBlue.black(' INFO '), ...message)
}

export function clear() {
  process.stdout.write(CLEAR_SCREEN)
}

export function raw(message: string, code: number = ExitCode.OK, exit = false) {
  if (code === ExitCode.OK) {
    process.stdout.write(message)
  } else {
    process.stderr.write(message)
  }
  if (exit) {
    process.exit(code)
  }
}
