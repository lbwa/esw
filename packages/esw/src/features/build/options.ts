import { BuildOptions } from 'esbuild'
import { UNIVERSAL_COMMAND_OPTIONS } from '@cli/options'
import { tuple } from '@root/utils/data-structure'

export interface EswBuildOptions extends BuildOptions {
  clearBeforeBuild?: boolean
}

export const ESW_BUILD_OPTIONS_SPEC = {
  ...UNIVERSAL_COMMAND_OPTIONS,
  '--clearBeforeBuild': Boolean
}

export const ESW_BUILD_COMMAND_SPEC = {
  ...ESW_BUILD_OPTIONS_SPEC,

  // esbuild options
  '--absWorkingDir': String,
  '--entryPoints': tuple([String])
}

export type EswBuildCommandSpec = typeof ESW_BUILD_COMMAND_SPEC

const eswBuildCommandKeys = Object.keys(ESW_BUILD_OPTIONS_SPEC)
const eswBuildOptionKeys = eswBuildCommandKeys.map(key =>
  key.replace(/^-+/, '')
)

export function isEswBuildOptionKey(key: string) {
  return eswBuildCommandKeys.includes(key) || eswBuildOptionKeys.includes(key)
}
