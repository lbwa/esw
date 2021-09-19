import fs from 'fs'
import path from 'path'
import type { SpawnSyncOptions } from 'child_process'
import spawn from 'cross-spawn'
import { ExitCode } from '@eswjs/common'
import { resolveFixture } from './shared'

const libDist = path.resolve(__dirname, '..', 'dist')
const binDist = path.resolve(libDist, 'bin')
const testRoot = path.resolve(__dirname, '.')
const eswBinary = path.resolve(binDist, 'esw.js')

beforeAll(async () => {
  const withDeps = path.resolve(testRoot, 'with-deps')
  await fs.promises.rm(path.resolve(withDeps, 'dist'), {
    force: true,
    recursive: true
  })
})

async function createBuildScript(
  fixturePath: string,
  commandArgs: string[] = ['build'],
  outFiles: Partial<Record<'esm' | 'cjs', string>> = {},
  spawnOptions = {} as SpawnSyncOptions
) {
  function resolveFixture(p: string) {
    return path.resolve(fixturePath, p)
  }
  const result = spawn.sync('node', [eswBinary, ...commandArgs], {
    encoding: 'utf-8',
    ...spawnOptions,
    cwd: fixturePath
  })
  // Process exited too early. The system ran out of memory or someone
  // called `kill -9` on the process
  expect(result.signal).not.toEqual('SIGKILL')
  // Process exited too early. The system could be shutting down or someone
  // might have called `kill` or `killall`
  expect(result.signal).not.toEqual('SIGTERM')
  expect(result.error).toBeNull()
  expect(result.status).toEqual(ExitCode.OK)

  process.stdout.write(result.output.filter(Boolean).join('\n'))

  Object.values(outFiles).forEach(p => {
    expect(fs.existsSync(resolveFixture(p))).toBeTruthy()
    expect(result.stdout).toContain(p)
  })
  const { esm, cjs } = outFiles
  return Promise.all(
    [esm, cjs].filter(Boolean).map(p =>
      fs.promises.readFile(
        path.resolve(resolveFixture(fixturePath), p as string),
        {
          encoding: 'utf8'
        }
      )
    )
  )
}

describe('esw cli', () => {
  it('should print root help message', () => {
    const shouldPrintHelp = spawn.sync('node', [eswBinary, '--help'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    })
    expect(shouldPrintHelp.output).toMatchSnapshot(
      '--help should print help message'
    )

    const shouldPrintHelpWithAlias = spawn.sync('node', [eswBinary, '-h'], {
      cwd: process.cwd(),
      encoding: 'utf8'
    })
    expect(shouldPrintHelpWithAlias.output).toMatchSnapshot(
      '-h should print help message'
    )
    expect(shouldPrintHelpWithAlias.output).toEqual(shouldPrintHelp.output)

    const shouldPrintHelpWithWrongCommand = spawn.sync(
      'node',
      [eswBinary, 'wrongCommand'],
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

  it('should print the esw version message', () => {
    const versionReg = /v\d+\.\d+\.\d+/

    ;[
      [eswBinary, '--version'],
      [eswBinary, '-v'],
      [eswBinary, 'build', '--version']
    ].forEach(args => {
      const shouldPrintVersionMsg = spawn.sync('node', args, {
        encoding: 'utf-8'
      })
      expect(shouldPrintVersionMsg.stdout).toMatch(versionReg)
    })
  })
})

describe('esw cli - build', () => {
  it('should work with no-options', async () => {
    await Promise.all(
      ['index.esm.js', 'index.js'].map(file =>
        fs.promises.rm(path.resolve(testRoot, 'fixture/no-options', file), {
          force: true,
          recursive: true
        })
      )
    )
    const fixturePath = resolveFixture('no-options')
    const [esmOutput, cjsOutput] = await createBuildScript(
      fixturePath,
      ['build'],
      { esm: 'index.esm.js', cjs: 'dist/cjs/index.js' }
    )

    expect(esmOutput).not.toContain('__esModule')
    expect(cjsOutput).toContain('__esModule')
  })

  it('should mark all peerDependencies and dependencies as external', async () => {
    const [esmOutput, cjsOutput] = await createBuildScript(
      resolveFixture('with-deps'),
      ['build'],
      {
        esm: 'dist/index.esm.js',
        cjs: 'dist/index.js'
      }
    )

    expect(esmOutput).toContain(`from "react"`)
    expect(esmOutput).toContain(`from "rxjs"`)
    expect(esmOutput).toContain(`from "rxjs/operators"`)

    expect(cjsOutput).toContain(`require("react")`)
    expect(cjsOutput).toContain(`require("rxjs")`)
    expect(cjsOutput).toContain(`require("rxjs/operators")`)
  })

  it('should print the help message of build command', () => {
    const shouldPrintHelpMsg = spawn.sync(
      'node',
      [eswBinary, 'build', '--help'],
      {
        cwd: process.cwd(),
        encoding: 'utf8'
      }
    )
    expect(shouldPrintHelpMsg.output).toMatchSnapshot(
      'build --help should print help message'
    )

    const shouldPrintHelpWithWrongCommand = spawn.sync(
      'node',
      [eswBinary, 'build', '--mini'],
      {
        cwd: process.cwd(),
        encoding: 'utf8'
      }
    )
    expect(shouldPrintHelpWithWrongCommand.stderr).toMatch(/error/i)
    expect(shouldPrintHelpWithWrongCommand.stderr).toContain(
      'Unknown arguments: --mini'
    )
    expect(shouldPrintHelpMsg.stderr).toEqual(
      shouldPrintHelpWithWrongCommand.stdout
    )

    const shouldPrintHelpWithAlias = spawn.sync(
      'node',
      [eswBinary, 'build', '-h'],
      {
        cwd: process.cwd(),
        encoding: 'utf8'
      }
    )
    expect(shouldPrintHelpWithAlias.output).toMatchSnapshot(
      'build -h should print help message'
    )
    expect(shouldPrintHelpWithAlias.stdout).toEqual(shouldPrintHelpMsg.stdout)
  })

  it('should work with uniq main and module field', async () => {
    await Promise.all(
      ['lib.js', 'index.js'].map(file =>
        fs.promises.rm(
          path.resolve(testRoot, 'fixture/uniq-main-module', file),
          {
            force: true,
            recursive: true
          }
        )
      )
    )
    const [esm, cjs] = await createBuildScript(
      path.resolve(testRoot, 'fixture/uniq-main-module'),
      ['build', 'index.ts'],
      {
        esm: `dist/lib.js`,
        cjs: `dist/index.js`
      }
    )

    expect(esm).not.toContain(`__esModule`)
    expect(cjs).toContain(`__esModule"`)
  })

  it('should throw a error message when building failed', async () => {
    const result = spawn.sync('node', [eswBinary, 'build'], {
      cwd: resolveFixture('build-error'),
      encoding: 'utf8'
    })
    expect(result.status).toEqual(ExitCode.ERROR)
    expect(result.stderr).toMatch(/could not resolve/i)
    expect(result.stdout).toEqual('')
  })
})
