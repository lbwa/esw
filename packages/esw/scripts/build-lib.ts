import { analyzeMetafile, build, Metafile } from 'esbuild'
import pick from 'lodash/pick'
import packageJson from '../package.json'
;(async () => {
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
    metafile: true
  })

  process.stdout.write(
    await analyzeMetafile(result.metafile as Metafile, {
      color: true,
      verbose: false
    })
  )
  process.stdout.write('\n')
})()
