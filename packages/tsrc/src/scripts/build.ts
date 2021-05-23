import { build as transpiler } from 'esbuild'
import glob from 'globby'
import createDebug from 'debug'
import { TranspileModuleType } from '..'

export type ScriptBuildConfigs = {
  entry: string
  outDir: string
  module: TranspileModuleType
  mode: 'development' | 'production'
}

const debug = createDebug('build')
const FILE_EXTENSIONS = ['js', 'jsx', 'cjs', 'ts', 'tsx']

export async function build({
  entry,
  outDir,
  module,
  mode
}: ScriptBuildConfigs) {
  const entryPoints = await glob(
    [`${entry}/*.@(${FILE_EXTENSIONS.join('|')})`],
    {
      gitignore: true
    }
  )
  debug(`entry points: %O`, entryPoints)

  const transpilationResult = await transpiler({
    entryPoints,
    outdir: outDir,
    format: module,
    // https://esbuild.github.io/api/#splitting
    splitting: module === 'esm',
    logLevel: 'error',
    metafile: true,
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode)
    }
  })

  const { metafile: metaFile } = transpilationResult

  debug(`output: %O`, Object.keys(metaFile?.outputs ?? {}))
}
