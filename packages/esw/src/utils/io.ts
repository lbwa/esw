import path from 'path'
import { mkdirSync, writeFileSync } from 'fs'

export async function writeToDiskSync(
  outPath: string,
  content: string | NodeJS.ArrayBufferView
) {
  mkdirSync(path.dirname(outPath), { recursive: true })
  writeFileSync(outPath, content, { encoding: null })
}
