import path from 'path'
import esbuild from 'esbuild'

export type SassPluginOptions = {
  implementation: 'sass' | 'node-sass'
  baseDir: string
}

const SASS_NAMESPACE = 'sass-lang'

function loadSass(impl: SassPluginOptions['implementation'], baseDir: string) {
  try {
    const url = require.resolve(impl, { paths: [baseDir] })
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(url) as typeof import('sass')
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      `Couldn't find module ${impl}, please ensure it has been installed. e.g. yarn add ${impl} -D`
    )
    process.exit(1)
  }
}

function loader(
  sass: ReturnType<typeof loadSass>
): (args: esbuild.OnLoadArgs) => Promise<esbuild.OnLoadResult> {
  return async ({ path }) => {
    const compiled = sass.renderSync({ file: path })

    return {
      contents: compiled.css.toString(),
      loader: 'css'
    }
  }
}

function createPlugin(
  {
    implementation = 'sass',
    baseDir = process.cwd()
  }: SassPluginOptions = {} as SassPluginOptions
): esbuild.Plugin {
  const sass = loadSass(implementation, baseDir)
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
      build.onLoad({ filter: /.*/, namespace: SASS_NAMESPACE }, loader(sass))
    }
  }
}

export default createPlugin
module.exports = createPlugin
