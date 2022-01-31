import path from 'path'
import fs from 'fs'
import { format } from 'util'
import { BuildOptions, Format } from 'esbuild'
import { map, tap, mergeMap, from, distinctUntilChanged } from 'rxjs'
import isNil from 'lodash/isNil'
import flow from 'lodash/flow'
import { assert, isDef, stdout } from '@eswjs/common'
import { PackageJson } from 'type-fest'
import { esbuildPluginExternalMark } from '../plugins/external-mark'
import { AvailableCommands } from '../cli/constants'

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

interface InferenceMeta {
  outputPath: string
  entryPointField: 'main' | 'module'
  format: Format
  packageJson: PackageJson
}

async function parsePackageJson(cwd: string): Promise<PackageJson> {
  const filepath = path.resolve(cwd, 'package.json')
  const message = format('ENOENT: "package.json" is required, %s', filepath)
  try {
    const stat = await fs.promises.stat(filepath)
    assert(stat.isFile(), message)
  } catch (error) {
    throw new Error(message)
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(filepath) as PackageJson
}

function getInferenceMeta<Formats extends readonly Format[]>(
  packageJson: PackageJson,
  formats: Formats
) {
  return formats.reduce((metaGroup, format) => {
    const outFieldKeyInPkgJson = FORMAT_TO_PKG_FIELD.get(format)
    if (isNil(outFieldKeyInPkgJson)) return metaGroup
    const outFieldValueInPkgJson = packageJson[outFieldKeyInPkgJson]
    if (isNil(outFieldValueInPkgJson)) return metaGroup

    const isMainFieldMatched = outFieldKeyInPkgJson === 'main'
    const isModuleFieldMatched = outFieldKeyInPkgJson == 'module'
    const isValidModuleFieldMatched = isModuleFieldMatched && format === 'esm'

    if (isMainFieldMatched || isValidModuleFieldMatched) {
      metaGroup.push({
        outputPath: outFieldValueInPkgJson,
        entryPointField: outFieldKeyInPkgJson,
        format,
        packageJson
      })
      return metaGroup
    }

    assert(
      isModuleFieldMatched,
      "'module' field should always be treated as ES module syntax, see https://nodejs.org/dist/latest-v16.x/docs/api/packages.html#dual-commonjses-module-packages"
    )

    throw new Error(
      "Couldn't find valid 'main' or 'module' field in package.json"
    )
  }, [] as InferenceMeta[])
}

function ensureEntryPoints(cwd: string, meta: InferenceMeta) {
  return function ensureEntryPointsImpl(
    existsOptions: BuildOptions
  ): BuildOptions {
    if (isDef(existsOptions.entryPoints)) return existsOptions

    const entry = path.basename(meta.outputPath).replace(/\..+/, '')
    const candidates = ENTRY_POINTS_EXTS.map(ext =>
      path.resolve(cwd, entry + ext)
    )

    const matchedEntry = candidates.filter(file => fs.existsSync(file))

    assert(
      matchedEntry.length > 0,
      `esw couldn't infer the start point in the current scenario.
      1) Make sure entry file exists (support ${candidates
        .map(p => path.basename(p))
        .join(', ')}) in ${fs.realpathSync(cwd)}
      2) Or specify start point cli argument, eg. esw build src/index.ts
  `
    )
    return {
      ...existsOptions,
      entryPoints: matchedEntry
    }
  }
}

function inferEntryPoints({ outputPath }: InferenceMeta) {
  return function inferEntryPointsImpl(
    existsOptions: BuildOptions
  ): BuildOptions {
    const { entryPoints, outdir, absWorkingDir } = existsOptions

    if (!Array.isArray(entryPoints)) return existsOptions
    return {
      ...existsOptions,
      entryPoints: entryPoints.reduce((entries, entry) => {
        const serializedOutPath = path
          .relative(outdir as string, outputPath)
          .replace(/\..+$/, '')
        if (!isNil(entries[serializedOutPath])) {
          stdout.warn(
            `Duplicated outPath detected: ${path.relative(
              absWorkingDir ?? process.cwd(),
              outputPath
            )}.`
          )
        }
        entries[serializedOutPath] = entry
        return entries
      }, {} as Record<string, string>)
    }
  }
}

function createBuildOptions(cwd: string, inferredMeta: InferenceMeta) {
  const { outputPath, entryPointField, format } = inferredMeta

  return function createBuildOptionsImpl(
    existsOptions: BuildOptions
  ): BuildOptions {
    const options: BuildOptions = {
      bundle: true,
      incremental: false,
      ...existsOptions,
      logLevel: 'silent',
      write: true,
      metafile: true
    }
    /**
     * @description `module` field always specify the **ES module** entry point.
     * @see https://nodejs.org/api/packages.html#packages_dual_commonjs_es_module_packages
     */
    const fmt = entryPointField === 'module' ? format : options.format ?? format
    const outExt = options.outExtension ?? {
      '.js': path.basename(outputPath).replace(/[^.]+\.(.+)/i, '.$1')
    }

    const splitting = options.splitting ?? format === 'esm'
    return {
      ...options,
      absWorkingDir: cwd,
      outdir: options.outdir ?? path.dirname(outputPath),
      format: fmt ?? PKG_FIELD_TO_FORMAT.get(entryPointField),
      outExtension: outExt,
      splitting
    }
  }
}

function markDepsAsExternalParts({ packageJson }: InferenceMeta) {
  const dependencies = packageJson.dependencies ?? {}
  const peerDependencies = packageJson.peerDependencies ?? {}
  const dependencyGroups = [peerDependencies, dependencies].reduce(
    (names, deps) => names.concat(Object.keys(deps)),
    [] as string[]
  )

  return function markDepsAsExternalPartsImpl(
    options: BuildOptions
  ): BuildOptions {
    return {
      ...options,
      /**
       * make external plugin be the first one, so that we can mark deps as external codes as soon as possible
       */
      plugins: [esbuildPluginExternalMark(dependencyGroups)].concat(
        options.plugins ?? []
      )
    }
  }
}

export function createInference(
  options: BuildOptions,
  command: AvailableCommands,
  cwd: string = options.absWorkingDir || process.cwd()
) {
  function checkForbiddenOptions(options: BuildOptions): void {
    const { splitting, format, incremental } = options
    /** `incremental` only works with the file watcher */
    const isAllowIncremental =
      !incremental || command === AvailableCommands.Watch
    const isAllowSplitting = !splitting || format === 'esm'

    assert(
      isAllowIncremental,
      '"incremental" option only works with "watch" command.'
    )
    assert(
      isAllowSplitting,
      `"splitting" currently only works with "esm" format, instead of '${format}'`
    )
  }

  return from(parsePackageJson(cwd)).pipe(
    mergeMap((packageJson: PackageJson) =>
      getInferenceMeta(packageJson, PRESET_JS_FORMAT)
    ),
    distinctUntilChanged(
      ({ outputPath: prev }, { outputPath: now }) => prev === now
    ),
    map(meta =>
      flow(
        createBuildOptions(cwd, meta),
        ensureEntryPoints(cwd, meta),
        inferEntryPoints(meta),
        markDepsAsExternalParts(meta)
      )(options)
    ),
    tap(checkForbiddenOptions)
  )
}
