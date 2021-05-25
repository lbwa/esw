import { build as transpiler } from 'esbuild'
import glob from 'globby'
import createDebug from 'debug'
import isString from 'lodash/isString'
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

export const builder: BuildScriptModule['builder'] = function (yargs) {
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
      choices: ['cjs', 'esm'] as TranspileModuleType[]
    })
    .option('outDir', {
      type: 'string',
      default: 'dist',
      describe: 'Redirect output structure to the directory'
    })
    .option('mode', {
      type: 'string',
      default: 'development',
      describe: 'Current transpilation mode, development or production'
    })
    .option('target', {
      type: 'array',
      desc: 'Target browser/node.js environment'
    })
} as BuildScriptModule['builder']

export const handler: BuildScriptModule['handler'] = async function build({
  entry,
  outDir,
  module,
  target,
  mode
}) {
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
    target: target && isString(target) ? target.split(',') : target,
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
