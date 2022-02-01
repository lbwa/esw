/* eslint-disable @typescript-eslint/no-var-requires */
import fs from 'fs/promises'
import path from 'path'
import * as esbuild from 'esbuild'
import identity from 'lodash/identity'
import pick from 'lodash/pick'
import { PackageJson } from 'type-fest'
import {
  resolveFixture,
  getTestName,
  formatBuildResult,
  hasErrors,
  hasWarnings
} from './shared'
import { build } from '@root/index'

async function readOutputs(cwd: string) {
  const { main: cjsPath, module: esmPath } = require(path.resolve(
    cwd,
    'package.json'
  )) as PackageJson
  return Promise.all(
    ([cjsPath, esmPath].filter(Boolean) as string[]).map(p =>
      fs.readFile(path.resolve(cwd, p), { encoding: 'utf8' })
    )
  )
}

async function runFixtureCase(
  fixtureName: string,
  options: esbuild.BuildOptions,
  singleEntry = 'index.ts'
) {
  const cwd = resolveFixture(fixtureName)
  const results = await build({
    absWorkingDir: cwd,
    logLevel: 'debug',
    format: 'esm',
    entryPoints: [singleEntry],
    bundle: false,
    ...options
  })
  const buildResults = formatBuildResult(results, identity)
  expect(hasErrors(buildResults)).toBeFalsy()
  expect(hasWarnings(buildResults)).toBeFalsy()
  expect(
    buildResults.map(result => pick(result, 'warnings', 'errors'))
  ).toMatchSnapshot(getTestName())

  return readOutputs(cwd)
}

describe('build api', () => {
  it('should mark all peerDependencies and dependencies as external', async () => {
    const cwd = resolveFixture('with-deps')
    const results = await build({
      absWorkingDir: cwd,
      logLevel: 'debug'
    })
    const buildResults = formatBuildResult(results, identity)
    expect(buildResults).toHaveLength(2)
    expect(hasErrors(buildResults)).toBeFalsy()
    expect(hasWarnings(buildResults)).toBeFalsy()
    expect(
      buildResults.map(result => pick(result, 'warnings', 'errors'))
    ).toMatchSnapshot(getTestName())

    const { main: cjsPath, module: esmPath } = require(path.resolve(
      cwd,
      'package.json'
    )) as PackageJson
    const [cjsOutput, esmOutput] = await Promise.all([
      fs.readFile(path.resolve(cwd, cjsPath as string), { encoding: 'utf8' }),
      fs.readFile(path.resolve(cwd, esmPath as string), { encoding: 'utf8' })
    ])

    expect(esmOutput).toContain(`from "react"`)
    expect(esmOutput).toContain(`from "rxjs"`)
    expect(esmOutput).toContain(`from "rxjs/operators"`)

    expect(cjsOutput).toContain(`require("react")`)
    expect(cjsOutput).toContain(`require("rxjs")`)
    expect(cjsOutput).toContain(`require("rxjs/operators")`)
  })

  it('should work with main field and cjs syntax', async () => {
    const [output] = await runFixtureCase('only-main-field', {
      format: 'cjs'
    })
    expect(output).toContain(`require("./src/fib")`)
  })

  it('should work with main field and esm syntax', async () => {
    const [output] = await runFixtureCase('only-main-field', {
      // should respect option.format
      format: 'esm'
    })
    expect(output).toContain(`from "./src/fib"`)
  })

  it('should work with module field and esm syntax', async () => {
    const [output] = await runFixtureCase('only-module-field', {}, 'index.ts')
    expect(output).toContain(`from "./src/fib"`)
  })

  it("shouldn't override the esm inference from module field", async () => {
    const [output] = await runFixtureCase(
      'only-module-field',
      { format: 'cjs' },
      'index.ts'
    )
    expect(output).toContain(`from "./src/fib"`)
  })

  it('should override the cjs inference from main field', async () => {
    const [output] = await runFixtureCase(
      'only-module-field',
      { format: 'esm' },
      'index.ts'
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
    expect(err!.message).toContain(`"package.json" is required`)
  })

  it('should work with no options', async () => {
    await Promise.all(
      ['index.esm.js', 'index.js'].map(file =>
        fs.rm(path.resolve(__dirname, 'fixtures/no-options', file), {
          force: true,
          recursive: true
        })
      )
    )

    const fixtureName = 'no-options'
    const cwd = resolveFixture(fixtureName)
    const results = await build({
      absWorkingDir: cwd,
      logLevel: 'debug'
    })
    const buildResults = formatBuildResult(results, identity)
    expect(hasErrors(buildResults)).toBeFalsy()
    expect(hasWarnings(buildResults)).toBeFalsy()
    expect(
      buildResults.map(result => pick(result, 'warnings', 'errors'))
    ).toMatchSnapshot(getTestName())

    const [cjsOutput, esmOutput] = await readOutputs(cwd)

    expect(cjsOutput).toContain(`__esModule"`)
    expect(esmOutput).not.toContain(`__esModule`)
  })

  it('should work with no options and main field', async () => {
    const cwd = resolveFixture('no-options-with-main')
    const results = await build({
      absWorkingDir: cwd,
      logLevel: 'debug'
    })
    const buildResults = formatBuildResult(results, identity)
    expect(buildResults).toHaveLength(1)
    expect(hasErrors(buildResults)).toBeFalsy()
    expect(hasWarnings(buildResults)).toBeFalsy()
    expect(
      buildResults.map(result => pick(result, 'warnings', 'errors'))
    ).toMatchSnapshot(getTestName())

    const [cjsOutput] = await readOutputs(cwd)
    expect(cjsOutput).toContain(`__esModule"`)
  })

  it('should work with no options and module field', async () => {
    const cwd = resolveFixture('no-options-with-module')
    const results = await build({
      absWorkingDir: cwd,
      logLevel: 'debug'
    })
    const buildResults = formatBuildResult(results, identity)
    expect(buildResults).toHaveLength(1)
    expect(hasErrors(buildResults)).toBeFalsy()
    expect(hasWarnings(buildResults)).toBeFalsy()
    expect(
      buildResults.map(result => pick(result, 'warnings', 'errors'))
    ).toMatchSnapshot(getTestName())

    const [esmOutput] = await readOutputs(cwd)
    expect(esmOutput).not.toContain(`__esModule`)
  })

  it("shouldn't work with no valid entry field", async () => {
    const fixtureName = 'no-valid-entry-field'
    await expect(
      build({
        absWorkingDir: resolveFixture(fixtureName),
        logLevel: 'debug'
      })
    ).rejects.toThrowErrorMatchingSnapshot(getTestName())
  })

  it('should emit building only once when we have duplicated output path', async () => {
    const result = await build({
      absWorkingDir: resolveFixture('duplicated-entry-points'),
      logLevel: 'debug'
    })
    expect(result).toHaveLength(1)
  })

  it('should emit a error when splitting: true and format !== esm', async () => {
    await expect(
      build({
        absWorkingDir: resolveFixture('no-options'),
        splitting: true,
        format: 'cjs'
      })
    ).rejects.toThrowErrorMatchingSnapshot('splitting: true and format !== esm')
  })

  it("shouldn't emit a error when write is true", async () => {
    await expect(
      build({
        absWorkingDir: resolveFixture('no-options'),
        logLevel: 'debug',
        write: true
      })
    ).resolves.toMatchSnapshot('works')
  })

  it("shouldn't emit rebuild when incremental is true", async () => {
    await expect(
      build({
        absWorkingDir: resolveFixture('no-options'),
        logLevel: 'debug',
        incremental: true
      })
    ).rejects.toThrowError('only works with "watch" command')
  })

  it('should emit e error when entryPoints.lenth === 0', async () => {
    await expect(
      build({
        absWorkingDir: resolveFixture('empty-entry'),
        logLevel: 'debug'
      })
    ).rejects.toThrowError("couldn't infer the start point")
  })
})
