import fs from 'fs'
import path from 'path'
import { build, BuildOptions } from 'esbuild'
import { map, tap, mergeMap, toArray, firstValueFrom, pipe, of } from 'rxjs'
import { isDef } from '@eswjs/common'
import { rmDirs } from '../../utils/io'
import { inferBuildOption } from './options'

function checkBuildOptions<Options extends BuildOptions>() {
  return pipe(
    // check options logics
    tap<Options>(options => {
      const { splitting, format } = options

      if (splitting && format !== 'esm') {
        throw new Error(
          `'splitting' currently only works with 'esm' format, instead of '${format}'`
        )
      }
    })
  )
}

async function findAllStaleDir(options: BuildOptions[]) {
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

export class Builder {
  options$ = of({} as BuildOptions)

  static new(cwd: string) {
    return new Builder(cwd)
  }

  constructor(private cwd: string = process.cwd()) {}

  inferOptions(options: BuildOptions) {
    this.options$ = inferBuildOption(options, this.cwd).pipe(
      checkBuildOptions()
    )
    return this
  }

  build(cleanBeforeBuild = true, options$ = this.options$) {
    const run$ = options$.pipe(
      toArray(),
      mergeMap(async options => {
        if (options.length < 1) {
          throw new Error(
            `Invalid operation. Maybe you forgot to define the main or module field in the package.json file.`
          )
        }

        if (cleanBeforeBuild) {
          await rmDirs(await findAllStaleDir(options))
        }

        return options
      }),
      map(options => options.map(options => build(options))),
      mergeMap(handles => Promise.allSettled(handles))
    )
    return run$
  }
}

export default function runBuild(
  options: BuildOptions = {},
  cwd: string = options.absWorkingDir || process.cwd()
) {
  return firstValueFrom(Builder.new(cwd).inferOptions(options).build(true))
}
