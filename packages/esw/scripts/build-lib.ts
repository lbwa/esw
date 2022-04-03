import { analyzeMetafile, build } from 'esbuild'
import pick from 'lodash/pick'
import packageJson from '../package.json'

const isWatchMode = process.argv.includes('--watch')

async function main() {
  const result = await build({
    entryPoints: ['src/bin/esw.js', 'src/index.ts'],
    bundle: true,
    platform: 'node',
    outdir: 'dist',
    outbase: 'src',
    tsconfig: 'tsconfig.json',
    target: 'node14',
    external: Object.values(
      pick(packageJson, ['dependencies', 'peerDependencies'])
    ).reduce(
      (externals, deps) => (externals as string[]).concat(Object.keys(deps)),
      [] as string[]
    ) as string[],
    metafile: true,
    logLevel: 'info',
    watch: isWatchMode
  })

  if (!isWatchMode) {
    process.stdout.write(
      await analyzeMetafile(result.metafile, {
        color: true,
        verbose: true
      })
    )
    process.stdout.write('\n')
  }
}

void main()
