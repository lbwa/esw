import { build as transpiler } from 'esbuild'
import { TranspileModuleType } from '..'

export type ScriptBuildConfigs = {
  entry: string
  outDir: string
  module: TranspileModuleType
}

export async function build({ entry, outDir, module }: ScriptBuildConfigs) {
  await transpiler({
    entryPoints: [entry],
    outdir: outDir,
    format: module
  })
}
