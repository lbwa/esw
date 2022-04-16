import { BuildOptions } from 'esbuild'
import { UNIVERSAL_COMMAND_OPTIONS } from '@root/cli/options'
import { tuple } from '@root/utils/data-structure'

export interface EswWatchOptions extends BuildOptions {
  //
}

export const ESW_WATCH_OPTIONS_SPEC = {
  ...UNIVERSAL_COMMAND_OPTIONS
}

export const ESW_WATCH_COMMAND_SPEC = {
  ...ESW_WATCH_OPTIONS_SPEC,

  // esbuild options
  '--absWorkingDir': String,
  '--entryPoints': tuple([String])
}

export type EswWatchCommandSpec = typeof ESW_WATCH_COMMAND_SPEC
