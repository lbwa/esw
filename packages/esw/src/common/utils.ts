import path from 'path'
import { mkdirSync, writeFileSync } from 'fs'

// https://github.com/microsoft/TypeScript/pull/39094#Spreads_in_array_literals
export function tuple<T extends unknown[]>(args: [...T]) {
  return args
}

export function isProduction(process: NodeJS.Process) {
  return process.env['NODE_ENV'] === 'production'
}

export function isFulfillResult<Data>(
  result: PromiseSettledResult<Data>
): result is PromiseFulfilledResult<Data> {
  return result.status === 'fulfilled'
}

export async function writeToDiskSync(
  outPath: string,
  content: string | NodeJS.ArrayBufferView
) {
  mkdirSync(path.dirname(outPath), { recursive: true })
  writeFileSync(outPath, content, { encoding: null })
}
