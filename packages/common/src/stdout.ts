/* eslint-disable no-console */
import chalk from 'chalk'
import { ExitCode, IS_PLATFORM_WINDOWS, IS_ENV_TEST } from '.'

export const colors = new chalk.Instance({ level: IS_ENV_TEST ? 0 : 1 })

/**
 * @see https://github.com/facebook/create-react-app/blob/v4.0.3/packages/react-dev-utils/clearConsole.js
 */
const CLEAR_SCREEN = IS_PLATFORM_WINDOWS
  ? '\x1B[2J\x1B[0f'
  : '\x1B[2J\x1B[3J\x1B[H'

export function wait(...message: string[]): void {
  console.log(colors.bgCyan.black(' WAIT '), ...message)
}

export function error(...message: string[]) {
  console.error(colors.bgRed.black(' ERROR '), ...message)
}

export function warn(...message: string[]) {
  console.warn(colors.bgYellow.black(' WARN '), ...message)
}

export function info(...message: string[]) {
  console.info(colors.bgBlue.black(' INFO '), ...message)
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
