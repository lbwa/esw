import { Plugin } from 'esbuild'
import isString from 'lodash/isString'

export default function externalDepsPlugin(deps: string[] = []): Plugin {
  return {
    name: 'external-deps',
    setup(build) {
      if (deps.length < 1) return

      const rules = (deps as (string | RegExp)[]).concat(
        // match `import isString from 'lodash/isString'`
        deps.map(name => new RegExp(`^${name}(?:$|\\/|\\)`))
      )
      build.onResolve({ filter: /.*/ }, args => {
        const matched = rules.some(rule =>
          isString(rule) ? rule === args.path : rule.test(args.path)
        )
        if (matched) return { path: args.path, external: true }
        // https://esbuild.github.io/plugins/#resolve-results
        return void 0
      })
    }
  }
}
