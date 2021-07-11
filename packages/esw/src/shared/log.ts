/* eslint-disable no-console */
import chalk from 'chalk'

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

export function printAndExit(message: string, code = 1) {
  if (code === 1) {
    error(message)
  } else {
    info(message)
  }
  process.exit(code)
}
