import path from 'path'
import fs from 'fs'
import { build, BuildOptions, BuildResult } from 'esbuild'
import { concatMap, iif, map, zip, of, pipe, tap, throwError, from } from 'rxjs'
import { PackageJson } from 'type-fest'
import externalEsBuildPlugin from './plugins/external'

const ENTRY_POINTS_EXTS = ['.js', '.jsx', '.ts', '.tsx']

function inferBuildOptions(cwd: string) {
  return pipe(
    concatMap((opts: BuildOptions) => {
      const pkgJsonPath = path.resolve(cwd, './', 'package.json')
      return iif(
        () => fs.existsSync(pkgJsonPath),
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        zip(of(opts), of(require(pkgJsonPath) as PackageJson)),
        throwError(
          () => new Error(`package.json is required in the ${pkgJsonPath}`)
        )
      )
    }),
    map(([opts, pkgJson]) => {
      // Keep all boolean falsy by default
      const options: BuildOptions = {
        bundle: false,
        logLevel: 'info',
        incremental: process.env['NODE_ENV'] === 'production',
        ...opts
      }
      return {
        options,
        pkgJson
      }
    }),
    // infer options.format
    concatMap(({ options, pkgJson }) => {
      const contexts = [{ options, pkgJson }]

      if (!pkgJson.main && !pkgJson.module) {
        options.format ??= 'iife'
      }
      if (pkgJson.module) {
        options.format ??= 'esm'
      }
      if (pkgJson.main) {
        const format = options.format ?? 'cjs'
        if (pkgJson.module) {
          // DO NOT modify options.format
          contexts.push({ options: { ...options, format }, pkgJson })
        } else {
          // Modify options.format directly
          options.format ??= format
        }
      }
      return from(contexts)
    }),
    // infer outdir
    map(({ options, pkgJson }) => {
      // use options.format to decide which output path should be chosen.
      const isESM = options.format === 'esm'
      const outPathInPkg = isESM ? pkgJson.module : pkgJson.main
      if (!options.outdir && !outPathInPkg) {
        throw new Error(
          `main or module field is required in package.json. They are the module IDs that is the primary entry point to the program. more details in https://docs.npmjs.com/cli/v7/configuring-npm/package-json/#main`
        )
      }
      const outDir = options.outdir ?? path.dirname(outPathInPkg as string)
      return {
        options,
        pkgJson,
        outDir,
        outPath: outPathInPkg
      }
    }),
    // infer entryPoints
    map(({ options, pkgJson, outPath }) => {
      const context = { options, pkgJson }
      if (options.entryPoints) {
        return context
      }
      if (!outPath) {
        throw new Error(
          `Couldn't infer project entry point. Please fill in main or module or both fields in package.json`
        )
      }
      const entry = path.basename(outPath).replace(/\..+/, '')
      const [matchedEntry] = ENTRY_POINTS_EXTS.map(ext =>
        path.resolve(cwd, entry + ext)
      ).filter(file => fs.existsSync(file))

      if (!matchedEntry) {
        throw new Error(
          `Couldn't infer project entry point (supports ${ENTRY_POINTS_EXTS.join(
            ', '
          )}) in ${path.resolve(cwd)}`
        )
      }

      options.entryPoints ??= [matchedEntry]

      return context
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
  return pipe(concatMap(({ options }: V) => build(options)))
}

export default function runBuild(
  options: BuildOptions = {},
  cwd: string = options.absWorkingDir || process.cwd()
) {
  const build$ = of(options).pipe(
    inferBuildOptions(cwd),
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
