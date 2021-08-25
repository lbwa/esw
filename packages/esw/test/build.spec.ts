import path from 'path'
import fs from 'fs'
import { exec, ExecException } from 'child_process'
import { BuildOptions, BuildResult } from 'esbuild'
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

function formatBuildResult(raw: PromiseSettledResult<BuildResult>[]) {
  return raw.reduce((results, result) => {
    if (result.status === 'fulfilled') {
      results.push(result.value)
    }
    return results
  }, [] as BuildResult[])
}

function hasErrors(results: BuildResult[]) {
  return results.every(result => result.errors.length > 1)
}

function hasWarnings(results: BuildResult[]) {
  return results.every(result => result.warnings.length > 1)
}

async function runFixtureCase(
  fixtureName: string,
  cacheDir: string,
  options: BuildOptions,
  singleEntry = 'index.ts',
  outFile = 'index.js'
) {
  await clearCacheDir(resolveFixture(`${fixtureName}/${cacheDir}`))
  const results = await build({
    absWorkingDir: resolveFixture(fixtureName),
    logLevel: 'debug',
    format: 'esm',
    entryPoints: [singleEntry],
    outdir: cacheDir,
    bundle: false,
    ...options
  })
  const buildResults = formatBuildResult(results)
  expect(hasErrors(buildResults)).toBeFalsy()
  expect(hasWarnings(buildResults)).toBeFalsy()
  expect(buildResults).toMatchSnapshot(getTestName())

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
    const results = await build({
      absWorkingDir: resolveFixture('typescript'),
      logLevel: 'debug',
      outdir: cacheDir
    })
    const buildResults = formatBuildResult(results)
    expect(buildResults).toHaveLength(2)
    expect(hasErrors(buildResults)).toBeFalsy()
    expect(hasWarnings(buildResults)).toBeFalsy()
    expect(buildResults).toMatchSnapshot(getTestName())
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
      // should respect option.format
      format: 'esm'
    })
    expect(output).toContain(`from "./src/fib"`)
  })

  it('should work with module field and esm syntax', async () => {
    const output = await runFixtureCase(
      'only-module-field',
      'dist',
      {},
      'index.ts',
      'index.esm.js'
    )
    expect(output).toContain(`from "./src/fib"`)
  })

  it("shouldn't override the esm inference from module field", async () => {
    const output = await runFixtureCase(
      'only-module-field',
      'dist',
      { format: 'cjs' },
      'index.ts',
      'index.esm.js'
    )
    expect(output).toContain(`from "./src/fib"`)
  })

  it('should override the cjs inference from main field', async () => {
    const output = await runFixtureCase(
      'only-module-field',
      'dist',
      { format: 'esm' },
      'index.ts',
      'index.esm.js'
    )
    expect(output).toContain(`from "./src/fib"`)
  })

  it("shouldn't work without package.json file", async () => {
    let err: Error | null = null
    await build({
      absWorkingDir: resolveFixture('required-package.json'),
      logLevel: 'debug',
      format: 'esm',
      entryPoints: ['index.ts'],
      outdir: 'dist',
      bundle: false
    }).catch((error: Error) => {
      err = error
    })
    expect(err).not.toBeNull()
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(err!.message).toContain(`package.json file doesn't exists`)
  })

  it('should work with no options', async () => {
    const fixtureName = 'no-options'
    const cacheDir = 'dist/internal'
    await clearCacheDir(resolveFixture(`${fixtureName}/${cacheDir}`))
    const results = await build({
      absWorkingDir: resolveFixture(fixtureName),
      logLevel: 'debug'
    })
    const buildResults = formatBuildResult(results)
    expect(hasErrors(buildResults)).toBeFalsy()
    expect(hasWarnings(buildResults)).toBeFalsy()
    expect(buildResults).toMatchSnapshot(getTestName())

    const outFiles = ['index.js', 'index.esm.js'].map(filename =>
      fs.existsSync(resolveFixture(`${fixtureName}/${cacheDir}/${filename}`))
    )
    expect(outFiles.every(exists => exists)).toBeTruthy()

    const resolvedCjsOutFile = await fs.promises.readFile(
      resolveFixture(`${fixtureName}/${cacheDir}/index.js`),
      { encoding: 'utf8' }
    )
    expect(resolvedCjsOutFile).toContain(`__esModule"`)

    const resolvedEsmOutFile = await fs.promises.readFile(
      resolveFixture(`${fixtureName}/${cacheDir}/index.esm.js`),
      { encoding: 'utf8' }
    )
    expect(resolvedEsmOutFile).not.toContain(`__esModule`)
  })
})
