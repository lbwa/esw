import fs from 'fs'
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

      const stat = await fs.promises.lstat(outdir).catch(() => null)
      if (isDef(stat) && stat.isDirectory() && !dirs.includes(outdir)) {
        dirs.push(outdir)
      }
    })
  )
  return dirs
}
