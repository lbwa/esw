import path from 'path'
import fs from 'fs'
import { build as esbuild, BuildOptions, BuildResult } from 'esbuild'
import { map, of, pipe, switchMap, tap } from 'rxjs'
import { PackageJson } from 'type-fest'
import externalEsBuildPlugin from './plugins/external'

const ENTRY_POINTS_EXTS = ['.js', '.jsx', '.ts', '.tsx']
const SOURCE_CODE_DIR = 'src'

function normalizeBuildOptions(cwd: string) {
  return pipe(
    // resolve package.json from cwd
    map((raw: BuildOptions) => {
      const pkgJsonPath = path.resolve(cwd, './', 'package.json')
      if (!fs.existsSync(pkgJsonPath)) {
        throw new Error(`package.json is required in the ${pkgJsonPath}`)
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pkgJson = require(pkgJsonPath) as PackageJson
      const options: BuildOptions = {
        format: 'cjs',
        bundle: true,
        logLevel: 'info',
        incremental: process.env['NODE_ENV'] === 'production',
        ...raw
      }
      return {
        options,
        pkgJson
      }
    }),
    // resolve entryPoints and outdir from package.json field
    tap(({ options, pkgJson }) => {
      // use options.format to decide which output path should be chosen.
      const outPath = options.format?.includes('esm')
        ? pkgJson.module
        : pkgJson.main

      if (!outPath) {
        throw new Error(
          `main or module field is required in package.json. They are the module IDs that is the primary entry point to the program. more details in https://docs.npmjs.com/cli/v7/configuring-npm/package-json/#main`
        )
      }

      const entry = path.basename(outPath).replace(path.extname(outPath), '')
      const outDir = path.dirname(outPath)

      const [matchedExt] = ENTRY_POINTS_EXTS.filter(ext =>
        fs.existsSync(path.resolve(cwd, SOURCE_CODE_DIR, entry + ext))
      )

      if (!options.entryPoints && !matchedExt) {
        throw new Error(
          `Couldn't infer project entry point (supports ${ENTRY_POINTS_EXTS.map(
            ext => `${SOURCE_CODE_DIR}/${entry}${ext}`
          ).join(', ')}) in ${path.resolve(cwd)}`
        )
      }

      options.entryPoints ??= [`${SOURCE_CODE_DIR}/${entry}${matchedExt}`]
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
        pkgJson: PackageJson
      }) => {
        const peerDeps = pkgJson.peerDependencies ?? {}
        const deps = pkgJson.dependencies ?? {}
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
