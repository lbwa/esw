export function isProduction(process: NodeJS.Process) {
  return process.env['NODE_ENV'] === 'production'
}
