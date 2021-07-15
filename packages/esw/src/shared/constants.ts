import { Handler as ArgHandler } from 'arg'
import { BuildOptions } from 'esbuild'

export enum ProcessCode {
  OK,
  ERROR
}

export type BuildArgsSpec = typeof BUILD_ARGS_SPEC

export const BUILD_ARGS_SPEC: Partial<
  Record<`--${keyof BuildOptions}`, string | ArgHandler | [ArgHandler]>
> = {
  '--absWorkingDir': String,
  '--allowOverwrite': Boolean,
  '--assetNames': String,
  // '--banner'
  '--bundle': Boolean,
  '--charset': function (val) {
    return val === 'ascii' ? val : null
  },
  '--chunkNames': String,
  '--color': Boolean,
  '--conditions': [String],
  // '--define'
  '--entryNames': String,
  '--entryPoints': [String],
  '--external': [String],
  // '--footer'
  '--format': function (val) {
    return ['cjs', 'esm', 'iife'].includes(val) ? val : null
  },
  '--globalName': String,
  '--incremental': Boolean,
  '--inject': [String],
  '--jsx': function (val) {
    return ['transform', 'preserve'].includes(val) ? val : null
  },
  '--jsxFactory': String,
  '--jsxFragment': String,
  '--keepNames': Boolean,
  '--legalComments': function (val) {
    return ['none', 'inline', 'eof', 'linked', 'external'].includes(val)
      ? val
      : null
  },
  // '--loader'
  '--logLevel': function (val) {
    return ['verbose', 'debug', 'info', 'warning', 'error', 'silent'].includes(
      val
    )
      ? val
      : null
  },
  '--logLimit': Number,
  '--mainFields': [String],
  '--metafile': Boolean,
  '--minify': Boolean,
  '--minifyIdentifiers': Boolean,
  '--minifySyntax': Boolean,
  '--minifyWhitespace': Boolean,
  '--nodePaths': [String],
  // '--outExtension'
  '--outbase': String,
  '--outdir': String,
  '--outfile': String,
  '--platform': val =>
    ['browser', 'node', 'neutral'].includes(val) ? val : null,
  // '--plugins'
  '--preserveSymlinks': Boolean,
  '--publicPath': String,
  '--pure': [String],
  '--resolveExtensions': [String],
  '--sourceRoot': String,
  '--sourcemap': function (val) {
    return ['true', 'false'].includes(val) ? val === 'true' : val
  },
  '--sourcesContent': Boolean,
  '--splitting': Boolean,
  // '--stdin'
  '--target': [String],
  '--treeShaking': function (val) {
    return val === 'true' || (val === 'ignore-annotations' ? val : null)
  },
  '--tsconfig': String,
  '--watch': Boolean,
  '--write': Boolean
}
