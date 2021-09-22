import fs from 'fs'
import { build, BuildOptions } from 'esbuild'
import { map, tap, mergeMap, toArray, firstValueFrom, pipe, of } from 'rxjs'
import { isDef } from '@eswjs/common'
import { inferBuildOption } from './options'

function checkBuildOptions<Options extends BuildOptions>() {
  return pipe(
    // check options logics
    tap<Options>(options => {
      const { splitting, format, write } = options

      if (splitting && format !== 'esm') {
        throw new Error(
          `'splitting' currently only works with 'esm' format, instead of '${format}'`
        )
      }

      if (write === true) {
        throw new Error(
          `option 'write' has been forbidden. because library writing has been handled by esw internal.`
        )
      }
    })
  )
}

type EsBuildInternalOutputPath = string
type DestinationPathFromPackageJson = string

export class Build {
  pathsMap = new Map<
    EsBuildInternalOutputPath,
    DestinationPathFromPackageJson[]
  >()
  options$ = of({} as BuildOptions)

  constructor(
    options: BuildOptions = {},
    cwd: string = options.absWorkingDir || process.cwd()
  ) {
    this.options$ = inferBuildOption(options, cwd, this.pathsMap)
  }

  run() {
    const run$ = this.options$.pipe(
      checkBuildOptions(),
      toArray(),
      mergeMap(async options => {
        if (options.length < 1) {
          throw new Error(
            `Invalid operation. Maybe you forgot to define the main or module field in the package.json file.`
          )
        }

        const pending = [] as string[]
        await Promise.all(
          options.map(async ({ outdir }) => {
            if (!outdir || !/^(?:\.\/)?[a-zA-Z0-9]+/i.test(outdir)) return

            const stat = await fs.promises.lstat(outdir).catch(() => null)
            if (
              isDef(stat) &&
              stat.isDirectory() &&
              !pending.includes(outdir)
            ) {
              pending.push(outdir)
            }
          })
        )
        await Promise.all(
          pending.map(outdir =>
            fs.promises.rm(outdir, { recursive: true, force: true })
          )
        )

        return options
      }),
      map(options => options.map(options => build(options))),
      mergeMap(handles => Promise.allSettled(handles))
    )
    return firstValueFrom(run$)
  }
}

export default function runBuild(
  options: BuildOptions = {},
  cwd: string = options.absWorkingDir || process.cwd()
) {
  return new Build(options, cwd).run()
}
