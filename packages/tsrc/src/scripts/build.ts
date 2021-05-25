import { build as transpiler } from 'esbuild'
import glob from 'globby'
import createDebug from 'debug'
import omit from 'lodash/omit'
import findKey from 'lodash/findKey'
import { CommandModule } from 'yargs'

type BuildScriptModule = CommandModule<{ command?: string }, ScriptBuildConfigs>

export type ScriptBuildConfigs = {
  entry: string
  outDir: string
  module: TranspileModuleType
  target?: string[]
  mode: TranspileModeEnv
}

const debug = createDebug('build')
const FILE_EXTENSIONS = ['js', 'jsx', 'cjs', 'ts', 'tsx']

export const command: BuildScriptModule['command'] = ['build [entry]']

export const describe: BuildScriptModule['describe'] = `Transpile JavaScript/TypeScript codebase`

export const builder = function builder(yargs) {
  return yargs
    .positional('entry', {
      describe: 'Specify transpile entrypoint',
      type: 'string',
      default: 'src'
    })
    .option('module', {
      type: 'string',
      desc: 'Specify module code generation',
      default: 'esm',
      choices: ['cjs', 'esm', 'iife'] as TranspileModuleType[]
    })
    .option('outDir', {
      type: 'string',
      default: 'dist',
      describe: 'Redirect output structure to the directory'
    })
    .option('mode', {
      type: 'string',
      default: 'production',
      describe: 'Current transpilation mode, development or production'
    })
    .option('target', {
      type: 'array',
      desc: 'Target browser/node.js environment'
    })
} as BuildScriptModule['builder']

export const handler: BuildScriptModule['handler'] = async function build(
  args
) {
  const { entry, outDir, module, mode, ...restProps } = args
  const entryPoints = await glob(
    [`${entry}/*.@(${FILE_EXTENSIONS.join('|')})`],
    {
      gitignore: true
    }
  )
  debug(`entry points: %O`, entryPoints)

  const findBoolStringMatchedKey = <V extends Record<string, unknown>>(
    group: V
  ) => findKey<V>(group, val => ['true', 'false'].includes(val as string))
  const esBuildProps = omit(restProps, ['_', '$0', 'out-dir'])
  let key = findBoolStringMatchedKey(esBuildProps)
  while (key) {
    esBuildProps[key] = JSON.parse(esBuildProps[key] as 'false' | 'true')
    key = findBoolStringMatchedKey(esBuildProps)
  }

  const transpilationResult = await transpiler({
    minify: mode === 'production',
    splitting: module === 'esm',
    metafile: true,
    ...omit(esBuildProps, ['_', '$0', 'out-dir']),
    entryPoints,
    outdir: outDir,
    format: module,
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode)
    }
  })

  const { metafile: metaFile } = transpilationResult

  debug(`output: %O`, Object.keys(metaFile?.outputs ?? {}))
}
