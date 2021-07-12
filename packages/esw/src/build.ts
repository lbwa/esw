import path from 'path'
import fs from 'fs'
import { build as esbuild, BuildOptions, BuildResult } from 'esbuild'
import { map, of, pipe, switchMap, tap } from 'rxjs'
import externalEsBuildPlugin from './plugins/external'

function normalizeBuildOptions(cwd: string) {
  return pipe(
    // resolve package.json from cwd
    map((raw: BuildOptions) => {
      const pkgJsonPath = path.resolve(cwd, './', 'package.json')
      if (!fs.existsSync(pkgJsonPath)) {
        throw new Error(`package.json is required in the ${pkgJsonPath}`)
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pkgJson = require(pkgJsonPath) as Record<string, unknown>
      const options: BuildOptions = {
        bundle: true,
        ...raw
      }
      return {
        options,
        pkgJson
      }
    }),
    // resolve outfile and outdir from package.json field
    tap(({ options, pkgJson }) => {
      const outPath = (pkgJson['main'] ?? pkgJson['module']) as string
      const outFile = path.basename(outPath).replace(path.extname(outPath), '')
      const outDir = path.basename(path.dirname(outFile))
      options.outfile ??= outFile
      options.outdir ??= outDir
    })
  )
}

function applyExternalPlugin() {
  return pipe(
    tap(
      ({
        options,
        pkgJson
      }: {
        options: BuildOptions
        pkgJson: Record<string, unknown>
      }) => {
        const peerDeps = pkgJson['peerDependencies'] as Record<string, string>
        const deps = pkgJson['dependencies'] as Record<string, string>
        const groups = ([] as string[]).concat(
          Object.keys(peerDeps),
          Object.keys(deps)
        )
        options.plugins = (options.plugins ?? []).concat(
          externalEsBuildPlugin(groups)
        )
      }
    )
  )
}

function invokeEsBuildBuild<V extends { options: BuildOptions }>() {
  return pipe(switchMap(({ options }: V) => esbuild(options)))
}

function build(
  options: BuildOptions = {},
  cwd: string = options.absWorkingDir || process.cwd()
) {
  const build$ = of(options).pipe(
    normalizeBuildOptions(cwd),
    applyExternalPlugin(),
    invokeEsBuildBuild()
  )
  return new Promise<BuildResult>((resolve, reject) => {
    build$.subscribe({
      next: resolve,
      error: reject
    })
  })
}

export default build
