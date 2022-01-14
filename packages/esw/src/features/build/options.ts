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
import isEmpty from 'lodash/isEmpty'
import { isDef, stdout } from '@eswjs/common'
import externalEsBuildPlugin from '../../plugins/external'
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

function inferEntryPoints<Meta extends { outPath: string }>(
  options: BuildOptions,
  { outPath }: Meta
): BuildOptions {
  const { entryPoints } = options

  if (!Array.isArray(entryPoints)) return options

  options.entryPoints = entryPoints.reduce((entries, entry) => {
    const serializedOutPath = path
      .relative(options.outdir as string, outPath)
      .replace(/\..+$/, '')
    if (!isNil(entries[serializedOutPath])) {
      stdout.warn(
        `Duplicated outPath detected: ${path.relative(
          options.absWorkingDir ?? process.cwd(),
          outPath
        )}.`
      )
    }
    entries[serializedOutPath] = entry
    return entries
  }, {} as Record<string, string>)
  return options
}

export function inferBuildOption(
  options: BuildOptions = {},
  cwd: string = options.absWorkingDir || process.cwd()
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

  const mergeOptions$ = of(options).pipe(
    map<BuildOptions, BuildOptions>(options => ({
      bundle: true,
      ...options,

      // the following options couldn't be override
      logLevel: 'silent', // disable esbuild internal stdout by default
      incremental: true,
      write: true,
      metafile: true // for printing build result to the terminal
    }))
  )

  const inferredOptions$ = combineLatest([mergeOptions$, inferenceMeta$]).pipe(
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

      const inferredOptions = {
        ...options,
        absWorkingDir: cwd,
        outdir: options.outdir ?? path.dirname(outPath),
        format: fmt ?? PKG_FIELD_TO_FORMAT.get(field),
        outExtension: outExt
      } as BuildOptions
      return [inferredOptions, meta] as const
    }),
    tap(([options, { outPath }]) => {
      if (isDef(options.entryPoints)) return

      const entry = path.basename(outPath).replace(/\..+/, '')
      const candidates = ENTRY_POINTS_EXTS.map(ext =>
        path.resolve(cwd, entry + ext)
      )

      const matchedEntry = candidates.filter(file => fs.existsSync(file))

      if (isEmpty(matchedEntry)) {
        throw new Error(
          `esw couldn't infer the start point in the current scenario.
    1) Make sure entry file exists (support ${candidates
      .map(p => path.basename(p))
      .join(', ')}) in ${fs.realpathSync(cwd)}
    2) Or specify start point cli argument, eg. esw build src/index.ts
`
        )
      }

      options.entryPoints ??= matchedEntry
    }),
    map(([options, meta]) => inferEntryPoints(options, meta)),
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
