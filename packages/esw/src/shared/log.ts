/* eslint-disable no-console */
import chalk from 'chalk'
import { ProcessCode } from './constants'
import { isDef } from './utils'

const prefixes = {
  error: chalk.red('error') + ' -',
  info: chalk.cyan('info') + '  -'
}

export function error(...message: string[]) {
  console.error(prefixes.error, ...message)
}

export function info(...message: string[]) {
  console.log(prefixes.info, ...message)
}

export function printAndExit(
  message: string,
  code: number = ProcessCode.ERROR
) {
  if (code === ProcessCode.OK) {
    console.info(message)
  } else if (isDef(code)) {
    console.error(message)
  }
  process.exit(code)
}
