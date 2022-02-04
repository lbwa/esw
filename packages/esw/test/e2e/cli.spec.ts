import path from 'path'
import { format } from 'util'
import fs from 'fs'
import { createCliDriver } from './driver/cli'
import { createSandbox, Sandbox } from './sandbox/sandbox'

describe('cli stdout', () => {
  let sandbox: Sandbox
  beforeAll(async () => {
    sandbox = await createSandbox()
    await sandbox.load(path.resolve(__dirname, 'fixtures/no-options'))
    await sandbox.install({
      esw: format('file:%s', process.env.E2E_LIB_PACK_PATH)
    })
  })

  beforeEach(async () => {
    return sandbox.reset()
  })

  afterAll(async () => {
    return sandbox.terminate()
  })

  it.each([
    ['print global message', ['--help']],
    ['print global message by alias', ['-h']],
    ['print global message with unknown command', ['unknownCommand']],
    ['print version', ['--version']],
    ['print version by alias', ['-v']],
    ['print build usage', ['build', '--help']],
    ['print build usage by alias', ['build', '-h']]
  ])('should %s', async (name, args) => {
    const driver = createCliDriver(sandbox.spawn('esw', args))
    const stdout = await driver.waitForStdout()
    expect(stdout).toMatchSnapshot(name)
  })
})

describe('esw build', () => {
  let sandbox: Sandbox
  beforeAll(async () => {
    sandbox = await createSandbox()
  })

  beforeEach(async () => {
    return sandbox.reset()
  })

  afterAll(async () => {
    return sandbox.terminate()
  })

  it('should work with no options', async () => {
    await sandbox.load(path.resolve(__dirname, 'fixtures/no-options'))
    await sandbox.install({
      esw: format('file:%s', process.env.E2E_LIB_PACK_PATH)
    })
    const driver = createCliDriver(sandbox.spawn('esw', ['build']))
    const result = await driver.waitForStdout()
    expect(result).toMatchSnapshot()

    const esmOutPath = path.resolve(sandbox.cwd, 'index.esm.js'),
      cjsOutPath = path.resolve(sandbox.cwd, 'dist/cjs/index.js')
    const esmContent = await fs.promises.readFile(esmOutPath, 'utf8')
    expect(esmContent).not.toContain('__esModule')
    expect(esmContent).not.toContain('module.exports')
    expect(esmContent).toMatch(/^export\s/m)
    const cjsContent = await fs.promises.readFile(cjsOutPath, 'utf8')
    expect(cjsContent).toContain('__esModule')
    expect(cjsContent).toContain('module.exports')
    expect(cjsContent).not.toMatch(/^export\s/)
  })

  it('should mark all dependencies/peerDependencies as external', async () => {
    await sandbox.load(path.resolve(__dirname, 'fixtures/with-deps'))
    await sandbox.install({
      esw: format('file:%s', process.env.E2E_LIB_PACK_PATH)
    })
    const driver = createCliDriver(sandbox.spawn('esw', ['build']))
    const result = await driver.waitForStdout()
    expect(result).toMatchSnapshot()

    const esmOutPath = path.resolve(sandbox.cwd, 'dist/index.esm.js'),
      cjsOutPath = path.resolve(sandbox.cwd, 'dist/index.js')
    const [esmContent, cjsContent] = await Promise.all(
      [esmOutPath, cjsOutPath].map(p => fs.promises.readFile(p, 'utf8'))
    )

    expect(esmContent).toContain(`from "react"`)
    expect(esmContent).toContain(`from "rxjs"`)
    expect(esmContent).toContain(`from "rxjs/operators"`)

    expect(cjsContent).toContain(`require("react")`)
    expect(cjsContent).toContain(`require("rxjs")`)
    expect(cjsContent).toContain(`require("rxjs/operators")`)
  })

  it('should throw a error when esbuild bundling failed', async () => {
    await sandbox.load(path.resolve(__dirname, 'fixtures/build-error'))
    await sandbox.install({
      esw: format('file:%s', process.env.E2E_LIB_PACK_PATH)
    })

    const driver = createCliDriver(sandbox.spawn('esw', ['build']))
    const error = await driver.waitForStderr()

    expect(error).toMatch(/could not resolve/i)
  })

  it('should clean dist first before next bundling start.', async () => {
    await sandbox.load(path.resolve(__dirname, 'fixtures/clean-dist'))
    await sandbox.install({
      esw: format('file:%s', process.env.E2E_LIB_PACK_PATH)
    })

    const cacheFile = path.resolve(sandbox.cwd, 'dist/cache.ts')
    await fs.promises.mkdir(path.dirname(cacheFile), { recursive: true })
    await fs.promises.writeFile(
      cacheFile,
      'export const message = "should be deleted."'
    )
    expect(fs.existsSync(cacheFile)).toBeTruthy()

    const driver = createCliDriver(sandbox.spawn('esw', ['build']))

    await driver.waitForStdout()

    expect(fs.existsSync(cacheFile)).toBeFalsy()
    const esmOutPath = path.resolve(sandbox.cwd, 'dist/index.esm.js'),
      cjsOutPath = path.resolve(sandbox.cwd, 'dist/index.js')
    const [esmContent, cjsContent] = await Promise.all(
      [esmOutPath, cjsOutPath].map(p => fs.promises.readFile(p, 'utf8'))
    )

    expect(esmContent).not.toContain('__esModule')
    expect(esmContent).not.toContain('module.exports')
    expect(esmContent).not.toContain('exports')
    expect(esmContent).toMatch(/^export\s/m)
    expect(cjsContent).toContain('__esModule')
    expect(cjsContent).toContain('module.exports')
  })
})
