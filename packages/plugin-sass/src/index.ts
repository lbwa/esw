import path from 'path'
import esbuild from 'esbuild'

export type SassPluginOptions = {
  implementation: 'sass' | 'node-sass'
  baseDir: string
}

const SASS_NAMESPACE = 'style-sass'

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
      build.onResolve({ filter: /\.s[ac]ss$/i }, args => ({
        path: path.resolve(args.resolveDir, args.path),
        namespace: SASS_NAMESPACE
      }))

      // define a loader
      build.onLoad({ filter: /.*/, namespace: SASS_NAMESPACE }, args => {
        const compiled = sass.renderSync({ file: args.path })
        return {
          contents: compiled.css.toString(),
          loader: 'css'
        }
      })
    }
  }
}

export default createPlugin
module.exports = createPlugin
