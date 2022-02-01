import { promises as fs } from 'fs'
import path from 'path'
import { BuildOptions } from 'esbuild'
import { isDef } from '@eswjs/common'

export async function findAllStaleDir(options: BuildOptions[]) {
  const dirs = [] as string[]
  await Promise.all(
    options.map(async ({ outdir, absWorkingDir = process.cwd() }) => {
      if (
        !outdir ||
        path.isAbsolute(outdir) ||
        path.resolve(absWorkingDir, outdir) === path.resolve(absWorkingDir)
      )
        return

      const stat = await fs.lstat(outdir).catch(() => null)
      if (isDef(stat) && stat.isDirectory() && !dirs.includes(outdir)) {
        dirs.push(outdir)
      }
    })
  )
  return dirs
}

export function rmDirs(dirs: string[]) {
  return Promise.all(
    dirs.map(dir => fs.rm(dir, { recursive: true, force: true }))
  )
}

export async function isFileExists(filepath: string) {
  try {
    const stat = await fs.stat(filepath)
    return stat.isFile()
  } catch (error) {
    return false
  }
}
