import { promises as fs } from 'fs'

export function rmDirs(dirs: string[]) {
  return Promise.all(
    dirs.map(dir => fs.rm(dir, { recursive: true, force: true }))
  )
}
