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
  scheduled
} from 'rxjs'
import { PackageJson } from 'type-fest'
import isNil from 'lodash/isNil'
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
      const { splitting, format, outdir } = options

      if (splitting && format !== 'esm') {
        throw new Error(`Splitting currently only works with the 'esm' format`)
      }

      if (isNil(outdir)) {
        throw new Error(
          `main or module field is required in package.json. They are the module IDs that is the primary entry point to the program. more details in https://docs.npmjs.com/cli/v7/configuring-npm/package-json/#main`
        )
      }
    })
  )
}

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
    map(([, outPath, field, alternativeFmt]) => ({
      outPath,
      field,
      alternativeFmt
    }))
  )

  const optionsWithDefault$ = of(options).pipe(
    map<BuildOptions, BuildOptions>(options => ({
      bundle: false,
      logLevel: 'info',
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
        format: fmt ?? PKG_FIELD_TO_FORMAT.get(field),
        outExtension: outExt
      } as BuildOptions
      return [clonedOptions, meta] as const
    }),
    map(([options, { outPath }]) => {
      if (isDef(options.entryPoints)) return options

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
      const groups = ([] as string[]).concat(
        Object.keys(peerDeps),
        Object.keys(deps)
      )
      options.plugins = (options.plugins ?? []).concat(
        externalEsBuildPlugin(groups)
      )
      return options
    })
  )

  const invokeEsBuildBuild$ = markDepsAsExternals$.pipe(
    toArray(),
    map(optionGroup => optionGroup.map(options => build(options))),
    mergeMap(insGroup => Promise.allSettled(insGroup))
  )

  return firstValueFrom(invokeEsBuildBuild$)
}
