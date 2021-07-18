import fs from 'fs'
import path from 'path'
import spawn from 'cross-spawn'
import { ProcessCode } from '../src/shared/constants'

const libDist = path.resolve(__dirname, '..', 'dist')
const binDist = path.resolve(libDist, 'bin')
const testRoot = path.resolve(__dirname, '.')
const fixtureTypescript = path.resolve(testRoot, 'fixture/typescript')
const cacheDir = 'dist/cli'
const bin = path.resolve(binDist, 'esw.js')

function resolveFixture(p: string) {
  return path.resolve(fixtureTypescript, p)
}

beforeAll(async () => {
  await fs.promises.rm(resolveFixture(cacheDir), {
    force: true,
    recursive: true
  })
  const result = spawn.sync('yarn', {
    stdio: 'inherit',
    cwd: fixtureTypescript
  })
  if (result.status != ProcessCode.OK) {
    throw new Error('Unexpected installation error')
  }
})

async function createBuildScript(commandArgs: string[], outfile: string) {
  const result = spawn.sync('node', [bin, ...commandArgs], {
    stdio: 'inherit',
    cwd: fixtureTypescript
  })
  // Process exited too early. The system ran out of memory or someone
  // called `kill -9` on the process
  expect(result.signal).not.toEqual('SIGKILL')
  // Process exited too early. The system could be shutting down or someone
  // might have called `kill` or `killall`
  expect(result.signal).not.toEqual('SIGTERM')
  expect(result.status).toEqual(ProcessCode.OK)
  expect(result.error).toBeNull()

  const outputPath = resolveFixture(outfile)
  expect(fs.existsSync(outputPath)).toBeTruthy()
  const output = await fs.promises.readFile(outputPath, {
    encoding: 'utf8'
  })
  return output
}

describe('cli command', () => {
  it('should work with entry points and no bundle', async () => {
    const output = await createBuildScript(
      [`--outdir=${cacheDir}/no-bundle`],
      `./${cacheDir}/no-bundle/index.esm.js`
    )
    expect(output).toContain('from "react"')
    expect(output).toContain(`from "react"`)
    expect(output).toContain(`from "rxjs"`)
    expect(output).toContain(`from "rxjs/operators"`)
  })

  it('should work with entry points and bundle', async () => {
    const output = await createBuildScript(
      ['--bundle', `--outdir=${cacheDir}/bundle`],
      `./${cacheDir}/bundle/index.esm.js`
    )
    expect(output).toContain('from "react"')
    expect(output).toContain(`from "react"`)
    expect(output).toContain(`from "rxjs"`)
    expect(output).toContain(`from "rxjs/operators"`)
  })
})
