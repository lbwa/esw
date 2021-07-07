import fs from 'fs'
import path from 'path'
import { build } from 'esbuild'
import sassPlugin from '.'

describe('sass plugin', () => {
  it('should work without bundle', async () => {
    const result = await build({
      entryPoints: ['./fixtures/index.sass'],
      outdir: 'dist/without-bundle',
      plugins: [sassPlugin],
      absWorkingDir: __dirname
    })
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
    const output = fs.readFileSync(
      path.resolve(__dirname, './dist/without-bundle/index.css'),
      { encoding: 'utf8' }
    )
    expect(output).toMatchSnapshot('work without bundle')
  })
})
