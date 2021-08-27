import fs from 'fs'
import path from 'path'
import type { SpawnSyncOptions } from 'child_process'
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
  outfile: Record<'esm' | 'cjs', string>,
  spawnOptions = {} as SpawnSyncOptions
) {
  const result = spawn.sync('node', [bin, ...commandArgs], {
    stdio: 'inherit',
    ...spawnOptions,
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
  return Promise.all([
    fs.promises.readFile(resolveFixture(esm), {
      encoding: 'utf8'
    }),
    fs.promises.readFile(resolveFixture(cjs), {
      encoding: 'utf8'
    })
  ])
}

describe('cli command', () => {
  it('should work with entry points and no bundle', async () => {
    const [esm, cjs] = await createBuildScript(
      ['build', `--outdir=${cacheDir}/no-bundle`],
      {
        esm: `./${cacheDir}/no-bundle/index.esm.js`,
        cjs: `./${cacheDir}/no-bundle/index.js`
      }
    )
    expect(esm).toContain('from "react"')
    expect(esm).toContain(`from "react"`)
    expect(esm).toContain(`from "rxjs"`)
    expect(esm).toContain(`from "rxjs/operators"`)

    expect(cjs).toContain('require("react")')
    expect(cjs).toContain(`require("react")`)
    expect(cjs).toContain(`require("rxjs")`)
    expect(cjs).toContain(`require("rxjs/operators")`)
  })

  it('should work with entry points and bundle', async () => {
    const [esm, cjs] = await createBuildScript(
      ['build', '--bundle', `--outdir=${cacheDir}/bundle`],
      {
        esm: `./${cacheDir}/bundle/index.esm.js`,
        cjs: `./${cacheDir}/bundle/index.js`
      }
    )
    expect(esm).toContain('from "react"')
    expect(esm).toContain(`from "react"`)
    expect(esm).toContain(`from "rxjs"`)
    expect(esm).toContain(`from "rxjs/operators"`)

    expect(cjs).toContain('require("react")')
    expect(cjs).toContain(`require("react")`)
    expect(cjs).toContain(`require("rxjs")`)
    expect(cjs).toContain(`require("rxjs/operators")`)
  })

  it('should print root help message', () => {
    const shouldPrintHelp = spawn.sync('node', [bin, '--help'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    })
    expect(shouldPrintHelp.output).toMatchSnapshot(
      '--help should print help message'
    )

    const shouldPrintHelpWithAlias = spawn.sync('node', [bin, '-h'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    })
    expect(shouldPrintHelpWithAlias.output).toMatchSnapshot(
      '-h should print help message'
    )
    expect(shouldPrintHelpWithAlias.output).toEqual(shouldPrintHelp.output)

    const shouldPrintHelpWithWrongCommand = spawn.sync(
      'node',
      [bin, 'wrongCommand'],
      {
        cwd: process.cwd(),
        encoding: 'utf8'
      }
    )

    expect(shouldPrintHelpWithWrongCommand.output).toMatchSnapshot(
      'wrong command should print help message'
    )
    expect(shouldPrintHelp.output).toEqual(
      shouldPrintHelpWithWrongCommand.output
    )
  })

  it('should print the help message of build command', () => {
    const shouldPrintHelpMsg = spawn.sync('node', [bin, 'build', '--help'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    })
    expect(shouldPrintHelpMsg.output).toMatchSnapshot(
      'build --help should print help message'
    )

    const shouldPrintHelpWithWrongCommand = spawn.sync(
      'node',
      [bin, 'build', '--mini'],
      {
        cwd: process.cwd(),
        encoding: 'utf8'
      }
    )
    expect(shouldPrintHelpWithWrongCommand.stderr).toMatchSnapshot(
      'build --mini should print help message'
    )
    expect(shouldPrintHelpMsg.stderr).toEqual(
      shouldPrintHelpWithWrongCommand.stdout
    )

    const shouldPrintHelpWithAlias = spawn.sync('node', [bin, 'build', '-h'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    })
    expect(shouldPrintHelpWithAlias.output).toMatchSnapshot(
      'build -h should print help message'
    )
    expect(shouldPrintHelpWithAlias.stdout).toEqual(shouldPrintHelpMsg.stdout)
  })
})
