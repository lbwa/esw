import path from 'path'
import fs from 'fs'
import { BuildOptions, Format } from 'esbuild'
import {
  map,
  of,
  tap,
  combineLatest,
  asapScheduler,
  scheduled,
  distinctUntilChanged,
  Observable,
  mergeMap,
  EMPTY
} from 'rxjs'
import isNil from 'lodash/isNil'
import isString from 'lodash/isString'
import { isDef } from '@eswjs/common'
import externalEsBuildPlugin from '../../plugins/external'
import { isProduction } from '../../utils/env'
import { resolvePackageJson } from '../../cli/package.json'

const PRESET_JS_FORMAT = ['cjs', 'esm'] as const
const ENTRY_POINTS_EXTS = ['.js', '.jsx', '.ts', '.tsx'] as const
const FORMAT_TO_PKG_FIELD = new Map<Format, 'main' | 'module'>([
  ['cjs', 'main'],
  ['esm', 'module']
] as const)
const PKG_FIELD_TO_FORMAT = new Map<'main' | 'module', Format>([
  ['main', 'cjs'],
  ['module', 'esm']
] as const)

type EsBuildInternalOutputPath = string
type DestinationPathFromPackageJson = string

export function inferBuildOption(
  options: BuildOptions = {},
  cwd: string = options.absWorkingDir || process.cwd(),
  outputPathMapping?: Map<
    EsBuildInternalOutputPath,
    DestinationPathFromPackageJson[]
  >
): Observable<BuildOptions> {
  const pkgJson$ = resolvePackageJson(cwd)

  const inferenceMeta$ = combineLatest([
    pkgJson$,
    scheduled(PRESET_JS_FORMAT, asapScheduler)
  ]).pipe(
    mergeMap(([pkgJson, format]) => {
      const outFieldKeyInPkgJson = FORMAT_TO_PKG_FIELD.get(format)
      if (isNil(outFieldKeyInPkgJson)) return EMPTY
      const outFieldValueInPkgJson = pkgJson[outFieldKeyInPkgJson]
      if (isNil(outFieldValueInPkgJson)) return EMPTY

      const isMainFieldMatched = outFieldKeyInPkgJson === 'main'
      const isModuleFieldMatched = outFieldKeyInPkgJson == 'module'
      const isValidModuleFieldMatched = isModuleFieldMatched && format === 'esm'

      if (isMainFieldMatched || isValidModuleFieldMatched) {
        return of({
          outPath: outFieldValueInPkgJson,
          field: outFieldKeyInPkgJson,
          alternativeFmt: format
        })
      }

      if (isModuleFieldMatched && !isValidModuleFieldMatched) {
        throw new Error("'module' field should alway point to esm format")
      }
      throw new Error(
        "Couldn't find valid 'main' and 'module' field in package.json"
      )
    }),
    distinctUntilChanged(
      ({ outPath: prevOutPath }, { outPath: currentOutPath }) =>
        prevOutPath === currentOutPath
    )
  )

  const optionsWithDefault$ = of(options).pipe(
    map<BuildOptions, BuildOptions>(options => ({
      bundle: true,
      logLevel: 'silent', // disable esbuild internal stdout by default
      incremental: isProduction(process),
      ...options
    }))
  )

  const inferredOptions$ = combineLatest([
    optionsWithDefault$,
    inferenceMeta$
  ]).pipe(
    map(([options, meta]) => {
      const { field, outPath, alternativeFmt } = meta
      const fmt =
        field === 'module'
          ? /**
             * @description `module` field always specify the **ES module** entry point.
             * @see https://nodejs.org/api/packages.html#packages_dual_commonjs_es_module_packages
             */
            alternativeFmt
          : options.format ?? alternativeFmt
      const outExt = options.outExtension ?? {
        '.js': path.basename(outPath).replace(/[^.]+\.(.+)/i, '.$1')
      }

      const clonedOptions = {
        ...options,
        absWorkingDir: cwd,
        outdir: options.outdir ?? path.dirname(outPath),
        format: fmt ?? PKG_FIELD_TO_FORMAT.get(field),
        write: options.write ?? false,
        metafile: options.metafile ?? true,
        outExtension: outExt
      } as BuildOptions
      return [clonedOptions, meta] as const
    }),
    tap(([options, { outPath }]) => {
      if (isDef(options.entryPoints)) return

      const entry = path.basename(outPath).replace(/\..+/, '')
      const candidates = ENTRY_POINTS_EXTS.map(ext =>
        path.resolve(cwd, entry + ext)
      )
      const matchedEntry = candidates.find(file => fs.existsSync(file))

      if (!matchedEntry) {
        throw new Error(
          `Couldn't infer the entry point of library (supported ${candidates
            .map(p => path.basename(p))
            .join(', ')}) in ${fs.realpathSync(cwd)}`
        )
      }

      options.entryPoints ??= [matchedEntry]
    }),
    map(([options, { outPath }]) => {
      const { absWorkingDir, entryPoints, outExtension } = options

      if (!isString(absWorkingDir)) {
        throw new Error(
          `Expect absWorkingDir is a string type, but we got ${typeof absWorkingDir}. This error is likely caused by a bug in esw. Please file an issue.`
        )
      }

      const entry = Array.isArray(entryPoints)
        ? entryPoints
        : isDef(entryPoints)
        ? Object.values(entryPoints)
        : []

      entry.forEach(entryPoint => {
        const filename = path.basename(entryPoint).replace(/\..+$/i, '')
        Object.values(outExtension ?? {}).forEach(key => {
          const rawPath = path.join(
            absWorkingDir,
            path.dirname(outPath),
            `${filename}${key}`
          )
          outputPathMapping?.set(
            rawPath,
            (outputPathMapping?.get(rawPath) ?? []).concat(outPath)
          )
        })
      })

      return options
    }),
    tap(options => {
      const { splitting, format } = options
      if (isNil(splitting) && format === 'esm') {
        options.splitting = true
      }
    })
  )

  const markDepsAsExternals$ = combineLatest([pkgJson$, inferredOptions$]).pipe(
    map(([pkgJson, options]) => {
      const deps = pkgJson.dependencies ?? {}
      const peerDeps = pkgJson.peerDependencies ?? {}
      const depGroups = [peerDeps, deps].reduce(
        (names, deps) => names.concat(Object.keys(deps)),
        [] as string[]
      )

      /**
       * make external plugin be the first one, so that we can mark deps as external codes as soon as possible
       */
      options.plugins = [externalEsBuildPlugin(depGroups)].concat(
        options.plugins ?? []
      )
      return options
    })
  )

  return markDepsAsExternals$
}
