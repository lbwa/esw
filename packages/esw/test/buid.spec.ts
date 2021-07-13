import path from 'path'
import fs from 'fs'
import { build } from '../src'

function getTestName() {
  return expect.getState().currentTestName.replace(/\s/g, '-')
}

function resolveFixture(name: string) {
  return path.resolve(__dirname, `./fixture/${name}`)
}

describe('node api - build', () => {
  it('should be works with package.json', async () => {
    const result = await build({
      absWorkingDir: resolveFixture('typescript'),
      logLevel: 'debug'
    })
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
    expect(result).toMatchSnapshot(getTestName())

    expect(
      fs.existsSync(resolveFixture('typescript/dist/index.js'))
    ).toBeTruthy()
  })
})
