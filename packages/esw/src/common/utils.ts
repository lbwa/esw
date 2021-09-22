// https://github.com/microsoft/TypeScript/pull/39094#Spreads_in_array_literals
export function tuple<T extends unknown[]>(args: [...T]) {
  return args
}

export function isProduction(process: NodeJS.Process) {
  return process.env['NODE_ENV'] === 'production'
}
