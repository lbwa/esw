import { Plugin as EsBuildPlugin } from 'esbuild'

export interface EswPlugin<Options extends Record<string, unknown>> {
  (options: Options): EsBuildPlugin
}
