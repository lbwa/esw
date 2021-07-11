/* eslint-disable jest/expect-expect */
import fs from 'fs/promises'
import path from 'path'
import { build } from 'esbuild'
import type esbuild from 'esbuild'
import sassPlugin from '.'

const cacheDir = path.resolve(__dirname, './.cache')

async function run(name: string, options: esbuild.BuildOptions = {}) {
  const outDir = `${cacheDir}/${name}`
  const result = await build({
    entryPoints: ['./fixtures/index.sass'],
    outdir: outDir,
    plugins: [sassPlugin()],
    absWorkingDir: __dirname,
    ...options
  })
  expect(result.errors).toHaveLength(0)
  expect(result.warnings).toHaveLength(0)
  const output = await fs.readFile(
    path.resolve(__dirname, outDir, `./index.css`),
    { encoding: 'utf8' }
  )
  return {
    result,
    output
  }
}

const getTestName = () =>
  expect
    .getState()
    .currentTestName.replace('sass plugin ', '')
    .replace(/\s/g, '-')

beforeAll(async () => {
  await fs.rm(cacheDir, { force: true, recursive: true })
})

describe('sass plugin', () => {
  it('should work without bundle', async () => {
    const { output } = await run(getTestName())
    expect(output).toMatchSnapshot(getTestName())
  })

  it('should work with bundle', async () => {
    const { output } = await run(getTestName(), { bundle: true })
    expect(output).toContain(`
html,
body {
  font-size: 16px;
}
`)
    expect(output).toContain(`
html,
body {
  color: var(--theme-primary);
}
`)
  })

  it('should work with css minify and bundle', async () => {
    const { output } = await run(getTestName(), { bundle: true, minify: true })
    expect(output).toMatchSnapshot(getTestName())
  })
})
