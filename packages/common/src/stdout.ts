/* eslint-disable no-console */
import chalk from './chalk'
import { ExitCode } from './const'
import { isDef } from '.'

export function wait(...message: string[]): void {
  console.log(chalk.bgCyan.black(' WAIT '), ...message)
}

export function error(...message: string[]) {
  console.error(chalk.bgRed.black(' ERROR '), ...message)
}

export function warn(...message: string[]) {
  console.warn(chalk.bgYellow.black(' WARN '), ...message)
}

export function printToTerminal(
  message: string,
  code: number = ExitCode.OK,
  exit = false
) {
  if (code === ExitCode.OK) {
    process.stdout.write(message)
  } else if (isDef(code)) {
    process.stderr.write(message)
  }
  if (exit) {
    process.exit(code)
  }
}
