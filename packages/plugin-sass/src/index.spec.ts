import fs from 'fs'
import path from 'path'
import { build } from 'esbuild'
import sassPlugin from '.'

describe('sass plugin', () => {
  it('should work without bundle', async () => {
    const result = await build({
      entryPoints: ['./fixtures/index.sass'],
      outdir: 'lib/without-bundle',
      plugins: [sassPlugin()],
      absWorkingDir: __dirname
    })
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
    const output = fs.readFileSync(
      path.resolve(__dirname, './lib/without-bundle/index.css'),
      { encoding: 'utf8' }
    )
    expect(output).toMatchSnapshot('work without bundle')
  })
})
