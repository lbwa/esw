import path from 'path'
import sass from 'sass'
import esbuild from 'esbuild'

const SASS_NAMESPACE = 'style-sass'

const plugin: esbuild.Plugin = {
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

export default plugin
module.exports = plugin
