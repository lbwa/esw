import path from 'path'
import fs from 'fs'
import { exec, ExecException } from 'child_process'
import { BuildOptions } from 'esbuild'
import { build } from '../src'

function getTestName() {
  return expect.getState().currentTestName.replace(/\s/g, '-')
}

function resolveFixture(name: string) {
  return path.resolve(__dirname, `./fixture/${name}`)
}

function clearCacheDir(dir: string) {
  return fs.promises.rm(dir, { force: true, recursive: true })
}

async function runFixtureCase(
  fixtureName: string,
  cacheDir: string,
  options: BuildOptions,
  singleEntry = 'index.ts',
  outFile = 'index.js'
) {
  await clearCacheDir(resolveFixture(`${fixtureName}/${cacheDir}`))
  const result = await build({
    absWorkingDir: resolveFixture(fixtureName),
    logLevel: 'debug',
    format: 'esm',
    entryPoints: [singleEntry],
    outdir: cacheDir,
    bundle: false,
    ...options
  })
  expect(result.errors).toHaveLength(0)
  expect(result.warnings).toHaveLength(0)
  expect(result).toMatchSnapshot(getTestName())

  expect(
    fs.existsSync(resolveFixture(`${fixtureName}/${cacheDir}/${outFile}`))
  ).toBeTruthy()

  return fs.promises.readFile(
    resolveFixture(`${fixtureName}/${cacheDir}/${outFile}`),
    { encoding: 'utf8' }
  )
}

beforeAll(async () => {
  await new Promise<ExecException | null>(r => {
    exec('yarn', { cwd: resolveFixture('typescript') }, r)
  })
})

describe('node api - build', () => {
  it('should work with package.json and dependencies', async () => {
    const cacheDir = 'dist/build'
    const outDir = resolveFixture(`typescript/${cacheDir}`)
    await clearCacheDir(outDir)
    const result = await build({
      absWorkingDir: resolveFixture('typescript'),
      logLevel: 'debug',
      outdir: cacheDir
    })
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
    expect(result).toMatchSnapshot(getTestName())
    ;['', '.esm'].map(type =>
      expect(
        fs.existsSync(resolveFixture(`typescript/${cacheDir}/index${type}.js`))
      ).toBeTruthy()
    )

    const output = await fs.promises.readFile(
      resolveFixture(`typescript/${cacheDir}/index.esm.js`),
      { encoding: 'utf8' }
    )
    expect(output).toContain(`from "react"`)
    expect(output).toContain(`from "rxjs"`)
    expect(output).toContain(`from "rxjs/operators"`)

    const cjsOutput = await fs.promises.readFile(
      resolveFixture(`typescript/${cacheDir}/index.js`),
      { encoding: 'utf8' }
    )
    expect(cjsOutput).toContain(`require("react")`)
    expect(cjsOutput).toContain(`require("rxjs")`)
    expect(cjsOutput).toContain(`require("rxjs/operators")`)
  })

  it('should work with main field and cjs syntax', async () => {
    const output = await runFixtureCase('only-main-field', 'dist/cjs', {
      format: 'cjs'
    })
    expect(output).toContain(`require("./src/fib")`)
  })

  it('should work with main field and esm syntax', async () => {
    const output = await runFixtureCase('only-main-field', 'dist/esm', {
      format: 'esm'
    })
    expect(output).toContain(`from "./src/fib"`)
  })

  it('should work with module field and esm syntax', async () => {
    const output = await runFixtureCase(
      'only-module-field',
      'dist',
      {
        format: 'esm'
      },
      'index.ts',
      'index.esm.js'
    )
    expect(output).toContain(`from "./src/fib"`)
  })
})
