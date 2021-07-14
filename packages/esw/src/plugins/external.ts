import { Plugin } from 'esbuild'

export default function externalDepsPlugin(deps: string[] = []): Plugin {
  return {
    name: 'external-deps',
    setup(build) {
      if (deps.length < 1) return

      const rules = deps.map(name => new RegExp(`^${name}(?:$|\\/|\\\\)`))
      build.onResolve({ filter: /.*/ }, args => {
        const matched = rules.some(rule => rule.test(args.path))
        if (matched) return { path: args.path, external: true }
        // https://esbuild.github.io/plugins/#resolve-results
        return void 0
      })
    }
  }
}
