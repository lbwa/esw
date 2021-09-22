import { tuple } from './utils'

// shareable cli args spec
export const UNI_ARGS_SPEC = {
  // esbuild args
  '--absWorkingDir': String,
  '--allowOverwrite': Boolean,
  '--assetNames': String,
  // '--banner'
  '--bundle': Boolean,
  '--charset': function (val: string) {
    return val === 'ascii' ? val : null
  },
  '--chunkNames': String,
  '--color': Boolean,
  '--conditions': tuple([String]),
  // '--define'
  '--entryNames': String,
  '--entryPoints': tuple([String]),
  '--external': tuple([String]),
  // '--footer'
  '--format': function (val: string) {
    return ['cjs', 'esm', 'iife'].includes(val) ? val : null
  },
  '--globalName': String,
  '--incremental': Boolean,
  '--inject': tuple([String]),
  '--jsx': function (val: string) {
    return ['transform', 'preserve'].includes(val) ? val : null
  },
  '--jsxFactory': String,
  '--jsxFragment': String,
  '--keepNames': Boolean,
  '--legalComments': function (val: string) {
    return ['none', 'inline', 'eof', 'linked', 'external'].includes(val)
      ? val
      : null
  },
  // '--loader'
  '--logLevel': function (val: string) {
    return ['verbose', 'debug', 'info', 'warning', 'error', 'silent'].includes(
      val
    )
      ? val
      : null
  },
  '--logLimit': Number,
  '--mainFields': tuple([String]),
  '--metafile': Boolean,
  '--minify': Boolean,
  '--minifyIdentifiers': Boolean,
  '--minifySyntax': Boolean,
  '--minifyWhitespace': Boolean,
  '--nodePaths': tuple([String]),
  // '--outExtension'
  '--outbase': String,
  '--outdir': String,
  '--outfile': String,
  '--platform': (val: string) =>
    ['browser', 'node', 'neutral'].includes(val) ? val : null,
  // '--plugins'
  '--preserveSymlinks': Boolean,
  '--publicPath': String,
  '--pure': tuple([String]),
  '--resolveExtensions': tuple([String]),
  '--sourceRoot': String,
  '--sourcemap': function (val: string) {
    return ['true', 'false'].includes(val) ? val === 'true' : val
  },
  '--sourcesContent': Boolean,
  '--splitting': Boolean,
  // '--stdin'
  '--target': tuple([String]),
  '--treeShaking': function (val: string) {
    return val === 'true' || (val === 'ignore-annotations' ? val : null)
  },
  '--tsconfig': String,
  '--write': Boolean,

  // non build args
  '--help': Boolean,

  // alias
  '-h': '--help'
}
