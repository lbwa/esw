import path from 'path'
import fs from 'fs'
import { exec, ExecException } from 'child_process'
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
  await new Promise<ExecException | null>(r => {
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

  it('should be output cjs syntax', async () => {
    const result = await build({
      absWorkingDir: resolveFixture('typescript'),
      logLevel: 'debug',
      format: 'cjs',
      entryPoints: ['src/cjs.ts']
    })
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
    expect(result).toMatchSnapshot(getTestName())

    expect(fs.existsSync(resolveFixture('typescript/dist/cjs.js'))).toBeTruthy()

    const output = await fs.promises.readFile(
      resolveFixture('typescript/dist/cjs.js'),
      { encoding: 'utf8' }
    )
    expect(output).toContain(`require("react")`)
    expect(output).toContain(`require("rxjs")`)
    expect(output).toContain(`require("rxjs/operators")`)
  })

  it('should be output iife syntax', async () => {
    const result = await build({
      absWorkingDir: resolveFixture('typescript'),
      logLevel: 'debug',
      format: 'iife',
      entryPoints: ['src/iife.ts']
    })
    expect(result.errors).toHaveLength(0)
    expect(result.warnings).toHaveLength(0)
    expect(result).toMatchSnapshot(getTestName())

    expect(
      fs.existsSync(resolveFixture('typescript/dist/iife.js'))
    ).toBeTruthy()

    const output = await fs.promises.readFile(
      resolveFixture('typescript/dist/iife.js'),
      { encoding: 'utf8' }
    )
    expect(output).toContain(`require("react")`)
    expect(output).toContain(`require("rxjs")`)
    expect(output).toContain(`require("rxjs/operators")`)
  })
})
