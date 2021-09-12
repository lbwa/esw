/* eslint-disable no-console */
import chalk from './chalk'

export function wait(...message: string[]): void {
  console.log(chalk.bgCyan.black(' WAIT '), ...message)
}

export function error(...message: string[]) {
  console.error(chalk.bgRed.black(' ERROR '), ...message)
}

export function warn(...message: string[]) {
  console.warn(chalk.bgYellow.black(' WARN '), ...message)
}
