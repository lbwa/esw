import path from 'path'
import esbuild from 'esbuild'
import type sass from 'sass'
import { EswPlugin, loadDependency } from '@eswjs/common'

export type SassPluginOptions = {
  implementation: 'sass' | 'node-sass'
  baseDir: string
}

const SASS_NAMESPACE = 'sass-lang'

const createSassImporter: (baseDir: string) => sass.Importer =
  baseDir => url => {
    // e.g. @import '~third-party-style';
    const normalized = url.replace(/^~/, '')
    return {
      file: require.resolve(normalized, { paths: [baseDir] })
    }
  }

function loader(
  { renderSync }: typeof import('sass'),
  baseDir: string
): (args: esbuild.OnLoadArgs) => Promise<esbuild.OnLoadResult> {
  const sassImporter = createSassImporter(baseDir)

  return async ({ path }) => {
    const { css } = renderSync({ file: path, importer: [sassImporter] })
    return {
      contents: css.toString(),
      loader: 'css'
    }
  }
}

const plugin: EswPlugin<SassPluginOptions> = function plugin(
  { implementation = 'sass', baseDir = process.cwd() } = {} as SassPluginOptions
): esbuild.Plugin {
  const sass = loadDependency<typeof import('sass')>(implementation, baseDir)
  return {
    name: 'plugin-sass',
    setup(build) {
      // define a resolver
      build.onResolve({ filter: /\.(?:(?:s[ac])|c)ss$/i }, args => {
        const isRelativePath = !path.isAbsolute(args.path)
        const dir = args.resolveDir || path.dirname(args.importer)
        const filepath = isRelativePath
          ? path.resolve(dir, args.path)
          : require.resolve(args.path, { paths: [dir] })
        return {
          path: filepath,
          namespace: SASS_NAMESPACE,
          pluginData: args
        }
      })

      // define a loader
      build.onLoad(
        { filter: /.*/, namespace: SASS_NAMESPACE },
        loader(sass, baseDir)
      )
    }
  }
}

export default plugin
module.exports = plugin
