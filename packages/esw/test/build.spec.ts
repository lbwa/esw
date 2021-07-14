import path from 'path'
import fs from 'fs'
import { exec } from 'child_process'
import { build } from '../src'

function getTestName() {
  return expect.getState().currentTestName.replace(/\s/g, '-')
}

function resolveFixture(name: string) {
  return path.resolve(__dirname, `./fixture/${name}`)
}

const outDir = resolveFixture('typescript/dist')

beforeAll(async () => {
  await fs.promises.rm(outDir, { force: true, recursive: true })
  await new Promise(r => {
    exec('yarn', { cwd: resolveFixture('typescript') }, r)
  })
})

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

    const output = await fs.promises.readFile(
      resolveFixture('typescript/dist/index.js'),
      { encoding: 'utf8' }
    )
    expect(output).toContain(`from "react"`)
    expect(output).toContain(`from "rxjs"`)
    expect(output).toContain(`from "rxjs/operators"`)
  })
})
