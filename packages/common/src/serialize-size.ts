import chalk from 'chalk'

const UNITS = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

function serializeBytes(number: number): string {
  if (number === 0) {
    return '0 B'
  }

  const exponent = Math.min(
    Math.floor(Math.log10(number) / 3),
    UNITS.length - 1
  )

  return `${+(number / Math.pow(1000, exponent)).toPrecision(3)} ${
    UNITS[exponent] as string
  }`
}

export function serializeSize(bytes: number) {
  const serialized = serializeBytes(bytes)
  if (bytes < 130 * 1e3) return chalk.green(serialized)
  if (bytes < 170 * 1e3) return chalk.yellow(serialized)
  return chalk.red.bold(serialized)
}
