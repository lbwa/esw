import chalk from 'chalk'

export function println(message: string) {
  process.stdout.write(
    message
      .split('\n')
      .map(line => chalk.gray(line))
      .join('\n')
  )
  process.stdout.write('\n')
}
