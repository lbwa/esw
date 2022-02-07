import path from 'path'
import { format } from 'util'
import { createCliDriver } from './driver/cli'
import { Sandbox, createSandbox } from './sandbox/sandbox'

describe('esw watch', () => {
  let sandbox: Sandbox
  beforeAll(async () => {
    sandbox = await createSandbox()

    // use arbitrary project to avoid to install local package multiple times.
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

  it('should watch file changes', async () => {
    await sandbox.load(path.resolve(__dirname, 'fixtures/no-options'))

    const driver = createCliDriver(sandbox.spawn('esw', ['watch']))
    expect(await driver.waitForStdout()).toEqual('')

    expect(await driver.waitForStdout()).toMatch(
      /watching for file changes in */i
    )

    await driver.waitForStdout()

    const [esmContent, cjsContent] = await sandbox.loadBuildResult([
      'index.esm.js',
      'dist/cjs/index.js'
    ])
    expect(esmContent).not.toContain('__esModule')
    expect(esmContent).not.toContain('module.exports')
    expect(esmContent).toMatch(/^export\s/m)
    expect(esmContent).toContain('return a')
    expect(esmContent).not.toContain('return a + 1')

    expect(cjsContent).toContain('__esModule')
    expect(cjsContent).toContain('module.exports')
    expect(cjsContent).not.toMatch(/^export\s/)
    expect(cjsContent).toContain('return a')
    expect(cjsContent).not.toContain('return a + 1')

    await sandbox.patch('src/fib.ts', 'return a', 'return a + 1')

    expect(await driver.waitForStdout()).toContain('change src/fib.ts')

    {
      await new Promise(r => setTimeout(r, 1e2))
      const [esmContent, cjsContent] = await sandbox.loadBuildResult([
        'index.esm.js',
        'dist/cjs/index.js'
      ])
      expect(esmContent).not.toContain('__esModule')
      expect(esmContent).not.toContain('module.exports')
      expect(esmContent).toMatch(/^export\s/m)
      expect(esmContent).toContain('return a + 1')
      expect(esmContent).not.toContain('return a;')

      expect(cjsContent).toContain('__esModule')
      expect(cjsContent).toContain('module.exports')
      expect(cjsContent).not.toMatch(/^export\s/)
      expect(cjsContent).toContain('return a + 1')
      expect(cjsContent).not.toContain('return a;')
    }
  })
})
