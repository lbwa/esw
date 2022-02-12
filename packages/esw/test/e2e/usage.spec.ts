import path from 'path'
import { format } from 'util'
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
    ['print build usage', ['build', '--help']],
    ['print build usage by alias', ['build', '-h']]
  ])('should %s', async (name, args) => {
    const driver = createCliDriver(sandbox.spawn('esw', args))
    const stdout = await driver.waitForStdout()
    expect(stdout).toMatchSnapshot(name)
  })

  it.each([
    ['print version', ['--version']],
    ['print version by alias', ['-v']]
    // eslint-disable-next-line @typescript-eslint/naming-convention
  ])('should %s', async (_, args) => {
    const driver = createCliDriver(sandbox.spawn('esw', args))
    const stdout = await driver.waitForStdout()
    expect(stdout).toMatch(/^v\d+\.\d+\.\d+/i)
  })
})
