import path from 'path'
import fs from 'fs'
import { build, BuildOptions, BuildResult, Format } from 'esbuild'
import {
  iif,
  map,
  zip,
  of,
  pipe,
  tap,
  throwError,
  mergeMap,
  filter
} from 'rxjs'
import { PackageJson } from 'type-fest'
import cloneDeep from 'lodash/cloneDeep'
import externalEsBuildPlugin from './plugins/external'
import { tuple } from './shared/utils'

const ENTRY_POINTS_EXTS = ['.js', '.jsx', '.ts', '.tsx']

type BuildContext = {
  options: BuildOptions
  pkgJson: PackageJson
}

function inferBuildOptions(cwd: string) {
  return pipe(
    mergeMap((opts: BuildOptions) => {
      const pkgJsonPath = path.resolve(cwd, './', 'package.json')
      const combineOptionsAndPkg$ = zip(
        of(opts),
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        of(require(pkgJsonPath) as PackageJson)
      )
      return iif(
        () => fs.existsSync(pkgJsonPath),
        combineOptionsAndPkg$,
        throwError(
          () =>
            new Error(`package.json file doesn't exists in the ${pkgJsonPath}`)
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
    // infer options.format & outExtension
    mergeMap(metadata => {
      const { options, pkgJson } = metadata

      function createInferObs(format: Format, outPath: string) {
        return of({ options: cloneDeep(options), pkgJson }).pipe(
          tap(metadata => {
            metadata.options.format ??= format
            // We don't judge outExtension whether is valid, so there is no
            // validation which is related to options.format
            metadata.options.outExtension ??= {
              '.js': path.basename(outPath).replace(/[^.]+\.(.+)/i, '.$1')
            }
          })
        )
      }

      return of(
        tuple(['cjs', pkgJson.main]),
        tuple(['esm', pkgJson.module])
      ).pipe(
        filter(([, outPath]) => !!outPath),
        // create a inference observable if we got a valid outPath
        mergeMap(pair => {
          return createInferObs(...(pair as [Format, string]))
        })
      )
    }),
    // infer options.outdir
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
    // infer options.entryPoints
    map(({ options, pkgJson, outPath }) => {
      const context = { options, pkgJson }
      if (options.entryPoints) {
        // respect user's entryPoints, skip inference
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
    tap(({ options, pkgJson }: BuildContext) => {
      const peerDeps = pkgJson.peerDependencies ?? {}
      const deps = pkgJson.dependencies ?? {}
      const groups = ([] as string[]).concat(
        Object.keys(peerDeps),
        Object.keys(deps)
      )
      options.plugins = (options.plugins ?? []).concat(
        externalEsBuildPlugin(groups)
      )
    })
  )
}

function invokeEsBuildBuild<V extends { options: BuildOptions }>() {
  return pipe(mergeMap(({ options }: V) => build(options)))
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
