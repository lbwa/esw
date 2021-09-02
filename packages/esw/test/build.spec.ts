import * as esbuild from 'esbuild'
import identity from 'lodash/identity'
import pick from 'lodash/pick'
import { build } from '../src'
import {
  resolveFixture,
  getTestName,
  formatBuildResult,
  hasErrors,
  hasWarnings
} from './shared'

async function runFixtureCase(
  fixtureName: string,
  options: esbuild.BuildOptions,
  singleEntry = 'index.ts'
) {
  const results = await build({
    absWorkingDir: resolveFixture(fixtureName),
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

  const [{ outputFiles: [{ text = null } = {}] = [] } = {}] = buildResults.map(
    result => pick(result, 'outputFiles')
  )
  return text
}

describe('build api', () => {
  it('should mark all peerDependencies and dependencies as external', async () => {
    const results = await build({
      absWorkingDir: resolveFixture('with-deps'),
      logLevel: 'debug'
    })
    const buildResults = formatBuildResult(results, identity)
    expect(buildResults).toHaveLength(2)
    expect(hasErrors(buildResults)).toBeFalsy()
    expect(hasWarnings(buildResults)).toBeFalsy()
    expect(
      buildResults.map(result => pick(result, 'warnings', 'errors'))
    ).toMatchSnapshot(getTestName())

    const [
      [{ text: cjsOutput = '' } = {}] = [],
      [{ text: esmOutput = '' } = {}] = []
    ] = buildResults.map(result => result.outputFiles)
    expect(esmOutput).toContain(`from "react"`)
    expect(esmOutput).toContain(`from "rxjs"`)
    expect(esmOutput).toContain(`from "rxjs/operators"`)

    expect(cjsOutput).toContain(`require("react")`)
    expect(cjsOutput).toContain(`require("rxjs")`)
    expect(cjsOutput).toContain(`require("rxjs/operators")`)
  })

  it('should work with main field and cjs syntax', async () => {
    const output = await runFixtureCase('only-main-field', {
      format: 'cjs'
    })
    expect(output).toContain(`require("./src/fib")`)
  })

  it('should work with main field and esm syntax', async () => {
    const output = await runFixtureCase('only-main-field', {
      // should respect option.format
      format: 'esm'
    })
    expect(output).toContain(`from "./src/fib"`)
  })

  it('should work with module field and esm syntax', async () => {
    const output = await runFixtureCase('only-module-field', {}, 'index.ts')
    expect(output).toContain(`from "./src/fib"`)
  })

  it("shouldn't override the esm inference from module field", async () => {
    const output = await runFixtureCase(
      'only-module-field',
      { format: 'cjs' },
      'index.ts'
    )
    expect(output).toContain(`from "./src/fib"`)
  })

  it('should override the cjs inference from main field', async () => {
    const output = await runFixtureCase(
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
    expect(err!.message).toContain(`package.json file doesn't exists`)
  })

  it('should work with no options', async () => {
    const fixtureName = 'no-options'
    const results = await build({
      absWorkingDir: resolveFixture(fixtureName),
      logLevel: 'debug'
    })
    const buildResults = formatBuildResult(results, identity)
    expect(hasErrors(buildResults)).toBeFalsy()
    expect(hasWarnings(buildResults)).toBeFalsy()
    expect(
      buildResults.map(result => pick(result, 'warnings', 'errors'))
    ).toMatchSnapshot(getTestName())

    const [
      { outputFiles: [{ text: cjsOutput = null } = {}] = [] } = {},
      { outputFiles: [{ text: esmOutput = null } = {}] = [] } = {}
    ] = buildResults.map(result => pick(result, 'outputFiles'))
    expect(cjsOutput).toContain(`__esModule"`)
    expect(esmOutput).not.toContain(`__esModule`)
  })

  it('should work with no options and main field', async () => {
    const results = await build({
      absWorkingDir: resolveFixture('no-options-with-main'),
      logLevel: 'debug'
    })
    const buildResults = formatBuildResult(results, identity)
    expect(buildResults).toHaveLength(1)
    expect(hasErrors(buildResults)).toBeFalsy()
    expect(hasWarnings(buildResults)).toBeFalsy()
    expect(
      buildResults.map(result => pick(result, 'warnings', 'errors'))
    ).toMatchSnapshot(getTestName())

    const [{ outputFiles: [{ text: cjsOutput = null } = {}] = [] } = {}] =
      buildResults.map(result => pick(result, 'outputFiles'))
    expect(cjsOutput).toContain(`__esModule"`)
  })

  it('should work with no options and module field', async () => {
    const results = await build({
      absWorkingDir: resolveFixture('no-options-with-module'),
      logLevel: 'debug'
    })
    const buildResults = formatBuildResult(results, identity)
    expect(buildResults).toHaveLength(1)
    expect(hasErrors(buildResults)).toBeFalsy()
    expect(hasWarnings(buildResults)).toBeFalsy()
    expect(
      buildResults.map(result => pick(result, 'warnings', 'errors'))
    ).toMatchSnapshot(getTestName())

    const [{ outputFiles: [{ text: esmOutput = null } = {}] = [] } = {}] =
      buildResults.map(result => pick(result, 'outputFiles'))
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

  /**
   * @see https://stackoverflow.com/a/57764111
   * @see https://stackoverflow.com/a/53166827
   * @see https://jestjs.io/docs/jest-object#jestdomockmodulename-factory-options
   */
  // TODO: Needs to mock esbuild dependency
  // eslint-disable-next-line jest/no-commented-out-tests
  // it('should emit building only once when we have duplicated output path', async () => {
  //   const mockBuild = jest.fn(() => Promise.resolve())
  //   // use jest.doMock to avoid jest to hoist mock to the beginning of the file
  //   // @see https://stackoverflow.com/a/53166827
  //   // @see https://jestjs.io/docs/jest-object#jestdomockmodulename-factory-options
  //   jest.doMock('esbuild', () => ({
  //     build: mockBuild
  //   }))
  //   await build({
  //     absWorkingDir: resolveFixture('duplicated-entry-points'),
  //     logLevel: 'debug'
  //   })
  //   expect(mockBuild).toBeCalledTimes(1)
  //   jest.resetModules()
  // })

  it('should emit a error when splitting: true and format !== esm', async () => {
    await expect(
      build({
        absWorkingDir: resolveFixture('no-options'),
        splitting: true,
        format: 'cjs'
      })
    ).rejects.toThrowErrorMatchingSnapshot('splitting: true and format !== esm')
  })

  it('should emit a error when write is true', async () => {
    await expect(
      build({
        absWorkingDir: resolveFixture('no-options'),
        logLevel: 'debug',
        write: true
      })
    ).rejects.toThrowErrorMatchingSnapshot("write shouldn't be true")
  })
})
