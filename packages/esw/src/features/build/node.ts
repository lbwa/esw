import fs from 'fs'
import path from 'path'
import { build, BuildOptions, BuildResult } from 'esbuild'
import { map, tap, mergeMap, toArray, firstValueFrom, of, from } from 'rxjs'
import { isDef } from '@eswjs/common'
import isFunction from 'lodash/isFunction'
import isEmpty from 'lodash/isEmpty'
import { rmDirs } from '../../utils/io'
import { isFulfillResult } from '../../utils/data-structure'
import { AvailableCommands } from '../../cli/constants'
import { inferBuildOption } from './options'

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

  private rebuilds: NonNullable<BuildResult['rebuild']>[] = []

  static new(command: AvailableCommands, cwd: string) {
    return new Builder(command, cwd)
  }

  constructor(
    private command: AvailableCommands,
    private cwd: string = process.cwd()
  ) {}

  inferOptions(options: BuildOptions) {
    this.options$ = inferBuildOption(options, this.command, this.cwd)
    return this
  }

  incrementalBuild(
    clearBeforeBuild = true,
    options$ = this.options$
  ): ReturnType<Builder['build']> {
    if (!isEmpty(this.rebuilds)) {
      return from(Promise.allSettled(this.rebuilds.map(rebuild => rebuild())))
    }

    return this.build(clearBeforeBuild, options$).pipe(
      tap(results => {
        results.forEach(result => {
          // only work with option.incremental: true
          if (isFulfillResult(result) && isFunction(result.value.rebuild)) {
            this.rebuilds.push(result.value.rebuild)
          }
        })
      })
    )
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
  return firstValueFrom(
    Builder.new(AvailableCommands.Build, cwd).inferOptions(options).build(true)
  )
}
