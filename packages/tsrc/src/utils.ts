export function printAndExit(msg: string, code = 1) {
  // eslint-disable-next-line no-console
  console[code === 0 ? 'log' : 'error'](msg)
  process.exit(code)
}
