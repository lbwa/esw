export enum ProcessCode {
  OK,
  ERROR
}

export type BuildArgsSpec = typeof BUILD_ARGS_SPEC

export const BUILD_ARGS_SPEC = {
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
  '--conditions': [String] as [typeof String],
  // '--define'
  '--entryNames': String,
  '--entryPoints': [String] as [typeof String],
  '--external': [String] as [typeof String],
  // '--footer'
  '--format': function (val: string) {
    return ['cjs', 'esm', 'iife'].includes(val) ? val : null
  },
  '--globalName': String,
  '--incremental': Boolean,
  '--inject': [String] as [typeof String],
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
  '--mainFields': [String] as [typeof String],
  '--metafile': Boolean,
  '--minify': Boolean,
  '--minifyIdentifiers': Boolean,
  '--minifySyntax': Boolean,
  '--minifyWhitespace': Boolean,
  '--nodePaths': [String] as [typeof String],
  // '--outExtension'
  '--outbase': String,
  '--outdir': String,
  '--outfile': String,
  '--platform': (val: string) =>
    ['browser', 'node', 'neutral'].includes(val) ? val : null,
  // '--plugins'
  '--preserveSymlinks': Boolean,
  '--publicPath': String,
  '--pure': [String] as [typeof String],
  '--resolveExtensions': [String] as [typeof String],
  '--sourceRoot': String,
  '--sourcemap': function (val: string) {
    return ['true', 'false'].includes(val) ? val === 'true' : val
  },
  '--sourcesContent': Boolean,
  '--splitting': Boolean,
  // '--stdin'
  '--target': [String] as [typeof String],
  '--treeShaking': function (val: string) {
    return val === 'true' || (val === 'ignore-annotations' ? val : null)
  },
  '--tsconfig': String,
  '--watch': Boolean,
  '--write': Boolean
}
