import { Plugin } from 'esbuild'

export function esbuildPluginExternalMark(deps: string[] = []): Plugin {
  return {
    name: 'esbuild-plugin-external-mark',
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
