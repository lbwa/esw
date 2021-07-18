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

async function createBuildScript(
  commandArgs: string[],
  outfile: Record<'esm' | 'cjs', string>
) {
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

  const { esm, cjs } = outfile
  Object.values(outfile).map(p =>
    expect(fs.existsSync(resolveFixture(p))).toBeTruthy()
  )
  return {
    esm: await fs.promises.readFile(resolveFixture(esm), {
      encoding: 'utf8'
    }),
    cjs: await fs.promises.readFile(resolveFixture(cjs), {
      encoding: 'utf8'
    })
  }
}

describe('cli command', () => {
  it('should work with entry points and no bundle', async () => {
    const output = await createBuildScript([`--outdir=${cacheDir}/no-bundle`], {
      esm: `./${cacheDir}/no-bundle/index.esm.js`,
      cjs: `./${cacheDir}/no-bundle/index.js`
    })
    expect(output.esm).toContain('from "react"')
    expect(output.esm).toContain(`from "react"`)
    expect(output.esm).toContain(`from "rxjs"`)
    expect(output.esm).toContain(`from "rxjs/operators"`)

    expect(output.cjs).toContain('require("react")')
    expect(output.cjs).toContain(`require("react")`)
    expect(output.cjs).toContain(`require("rxjs")`)
    expect(output.cjs).toContain(`require("rxjs/operators")`)
  })

  it('should work with entry points and bundle', async () => {
    const output = await createBuildScript(
      ['--bundle', `--outdir=${cacheDir}/bundle`],
      {
        esm: `./${cacheDir}/bundle/index.esm.js`,
        cjs: `./${cacheDir}/bundle/index.js`
      }
    )
    expect(output.esm).toContain('from "react"')
    expect(output.esm).toContain(`from "react"`)
    expect(output.esm).toContain(`from "rxjs"`)
    expect(output.esm).toContain(`from "rxjs/operators"`)

    expect(output.cjs).toContain('require("react")')
    expect(output.cjs).toContain(`require("react")`)
    expect(output.cjs).toContain(`require("rxjs")`)
    expect(output.cjs).toContain(`require("rxjs/operators")`)
  })
})
