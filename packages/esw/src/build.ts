import path from 'path'
import fs from 'fs'
import { build, BuildOptions, Format } from 'esbuild'
import {
  iif,
  map,
  of,
  tap,
  throwError,
  mergeMap,
  filter,
  toArray,
  firstValueFrom,
  combineLatest,
  pipe,
  asapScheduler,
  scheduled,
  distinctUntilChanged
} from 'rxjs'
import { PackageJson } from 'type-fest'
import isNil from 'lodash/isNil'
import isString from 'lodash/isString'
import { isDef } from '@eswjs/common'
import externalEsBuildPlugin from './plugins/external'
import { isProduction } from './shared/utils'

const ENTRY_POINTS_EXTS = ['.js', '.jsx', '.ts', '.tsx'] as const
const FORMAT_TO_PKG_FIELD = new Map<Format, 'main' | 'module'>([
  ['cjs', 'main'],
  ['esm', 'module']
] as const)

const PKG_FIELD_TO_FORMAT = new Map<'main' | 'module', Format>([
  ['main', 'cjs'],
  ['module', 'esm']
] as const)

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
export const outputPathMapping = new Map<
  EsBuildInternalOutputPath,
  DestinationPathFromPackageJson[]
>()

export default function runBuild(
  options: BuildOptions = {},
  cwd: string = options.absWorkingDir || process.cwd()
) {
  const resolvedPkgJsonPath = path.resolve(cwd, 'package.json')
  const pkgJsonPath$ = of(resolvedPkgJsonPath)
  const pkgJson$ = iif(
    () => fs.existsSync(resolvedPkgJsonPath),
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    pkgJsonPath$.pipe(map(pkgJsonPath => require(pkgJsonPath) as PackageJson)),
    throwError(
      () =>
        new Error(
          `package.json file doesn't exists in the ${resolvedPkgJsonPath}`
        )
    )
  )

  const alternativeFormats$ = scheduled(['cjs', 'esm'] as const, asapScheduler)
  const moduleIdFields$ = alternativeFormats$.pipe(
    map(format => FORMAT_TO_PKG_FIELD.get(format)),
    filter(Boolean)
  )

  const inferredOutPaths$ = combineLatest([pkgJson$, moduleIdFields$]).pipe(
    map(([pkgJson, field]) => pkgJson[field]),
    filter(Boolean)
  )

  const inferenceMeta$ = combineLatest([
    pkgJson$,
    inferredOutPaths$,
    moduleIdFields$,
    alternativeFormats$
  ]).pipe(
    filter(([pkgJson, outPath, field, format]) => {
      const isEsModuleEntry = field === 'module'
      const isAvailableEsModuleEntry = isEsModuleEntry && format === 'esm'
      const isMatchedField = pkgJson[field] === outPath

      return isMatchedField && (!isEsModuleEntry || isAvailableEsModuleEntry)
    }),
    distinctUntilChanged(
      ([, prevOutPath], [, currentOutPath]) => prevOutPath === currentOutPath
    ),
    map(([, outPath, field, alternativeFmt]) => ({
      outPath,
      field,
      alternativeFmt
    }))
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
          outputPathMapping.set(
            rawPath,
            (outputPathMapping.get(rawPath) ?? []).concat(outPath)
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
    }),
    checkBuildOptions()
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

  const invokeEsBuildBuild$ = markDepsAsExternals$.pipe(
    toArray(),
    tap(options => {
      if (options.length < 1) {
        throw new Error(
          `Invalid operation. Maybe you forgot to define the main or module field in the package.json file.`
        )
      }
    }),
    map(options => options.map(options => build(options))),
    mergeMap(handles => Promise.allSettled(handles))
  )

  return firstValueFrom(invokeEsBuildBuild$)
}
