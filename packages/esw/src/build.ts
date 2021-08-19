import path from 'path'
import fs from 'fs'
import { build, BuildOptions, Format } from 'esbuild'
import {
  iif,
  map,
  zip,
  of,
  pipe,
  tap,
  throwError,
  mergeMap,
  filter,
  toArray,
  firstValueFrom
} from 'rxjs'
import { PackageJson } from 'type-fest'
import cloneDeep from 'lodash/cloneDeep'
import externalEsBuildPlugin from './plugins/external'
import { isProduction, tuple } from './shared/utils'
import { lazyRequireObs } from './shared/observable'

const ENTRY_POINTS_EXTS = ['.js', '.jsx', '.ts', '.tsx'] as const
const AVAILABLE_OUTPUT_FORMATS: readonly Format[] = ['cjs', 'esm']
const enum InferenceAbility {
  ON = 1,
  OFF
}

type BuildContext = {
  options: BuildOptions
  pkgJson: PackageJson
}

function inferBuildOptions(cwd: string) {
  return pipe(
    mergeMap((opts: BuildOptions) => {
      const pkgJsonPath = path.resolve(cwd, './', 'package.json')
      const buildContext$ = zip(
        of(opts),
        lazyRequireObs<PackageJson>(pkgJsonPath)
      )
      const notFoundError$ = throwError(
        () =>
          new Error(`package.json file doesn't exists in the ${pkgJsonPath}`)
      )
      return iif(
        () => fs.existsSync(pkgJsonPath),
        buildContext$,
        notFoundError$
      )
    }),
    map(([opts, pkgJson]) => {
      // Keep all boolean falsy by default
      const options: BuildOptions = {
        bundle: false,
        logLevel: 'info',
        incremental: isProduction(process),
        splitting: opts.format === 'esm',
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

      function createInferObs(
        format: Format,
        outPath: string,
        inference: InferenceAbility
      ) {
        return of({ options: cloneDeep(options), pkgJson }).pipe(
          tap(metadata => {
            if (inference === InferenceAbility.ON) {
              metadata.options.format ??= format
            }
            // We don't judge outExtension whether is valid, so there is no
            // validation which is related to options.format
            metadata.options.outExtension ??= {
              '.js': path.basename(outPath).replace(/[^.]+\.(.+)/i, '.$1')
            }
          })
        )
      }

      return of(
        tuple(['cjs' as Format, pkgJson.main, InferenceAbility.ON]),
        /**
         * @description `module` field always specify the **ES module** entry point.
         * @see https://nodejs.org/api/packages.html#packages_dual_commonjs_es_module_packages
         */
        tuple(['esm' as Format, pkgJson.module, InferenceAbility.OFF])
      ).pipe(
        filter(
          ([format, outPath]) =>
            AVAILABLE_OUTPUT_FORMATS.includes(format) && !!outPath
        ),
        // create a inference observable if we got a valid outPath
        mergeMap(pair => {
          return createInferObs(...(pair as [Format, string, InferenceAbility]))
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
      return {
        options,
        pkgJson,
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
  return pipe(
    toArray<V>(),
    map(optGroup => optGroup.map(({ options }) => build(options))),
    mergeMap(buildGroup => Promise.allSettled(buildGroup))
  )
}

export default async function runBuild(
  options: BuildOptions = {},
  cwd: string = options.absWorkingDir || process.cwd()
) {
  const build$ = of(options).pipe(
    inferBuildOptions(cwd),
    applyExternalPlugin(),
    invokeEsBuildBuild()
  )
  return firstValueFrom(build$)
}
