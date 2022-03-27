import path from 'path'
import { format } from 'util'
import fs from 'fs'
import { createCliDriver } from './driver/cli'
import { createSandbox, Sandbox } from './sandbox/sandbox'

describe('esw build', () => {
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

  it('should work with no options', async () => {
    await sandbox.load(path.resolve(__dirname, 'fixtures/no-options'))

    const driver = createCliDriver(sandbox.spawn('esw', ['build']))
    const result = await driver.waitForStdout()
    expect(result).toContain('%')

    const [esmContent, cjsContent] = await sandbox.loadBuildResult([
      'index.esm.js',
      'dist/cjs/index.js'
    ])
    expect(esmContent).not.toContain('__esModule')
    expect(esmContent).not.toContain('module.exports')
    expect(esmContent).toMatch(/^export\s/m)
    expect(cjsContent).toContain('__esModule')
    expect(cjsContent).toContain('module.exports')
    expect(cjsContent).not.toMatch(/^export\s/)
  })

  it.each([
    [
      'no-options-with-main',
      ['dist/internal/index.js'],
      ['__esModule', 'module.exports'],
      [/^export\s/m]
    ],
    [
      'no-options-with-module',
      ['dist/internal/index.esm.js'],
      [/^export\s/m],
      ['__esModule', 'module.exports']
    ]
  ])('should work with %s', async (name, outPath, expects, unExpects) => {
    await sandbox.load(path.resolve(__dirname, `fixtures/${name}`))
    const driver = createCliDriver(sandbox.spawn('esw', ['build']))

    const stdout = await driver.waitForStdout()
    expect(stdout).toContain('%')

    const [output] = await sandbox.loadBuildResult(outPath)
    expects.forEach(ex => {
      if (ex instanceof RegExp) {
        expect(output).toMatch(ex)
      } else {
        expect(output).toContain(ex)
      }
    })
    unExpects.forEach(unEx => {
      if (unEx instanceof RegExp) {
        expect(output).not.toMatch(unEx)
      } else {
        expect(output).not.toContain(unEx)
      }
    })
  })

  it('should mark all dependencies/peerDependencies as external', async () => {
    await sandbox.load(path.resolve(__dirname, 'fixtures/with-deps'))

    const driver = createCliDriver(sandbox.spawn('esw', ['build']))
    const result = await driver.waitForStdout()
    expect(result).toContain('%')

    const [esmContent, cjsContent] = await sandbox.loadBuildResult([
      'dist/index.esm.js',
      'dist/index.js'
    ])

    expect(esmContent).toContain(`from "react"`)
    expect(esmContent).toContain(`from "rxjs"`)
    expect(esmContent).toContain(`from "rxjs/operators"`)

    expect(cjsContent).toContain(`require("react")`)
    expect(cjsContent).toContain(`require("rxjs")`)
    expect(cjsContent).toContain(`require("rxjs/operators")`)
  })

  it('should throw a error when esbuild bundling failed', async () => {
    await sandbox.load(path.resolve(__dirname, 'fixtures/build-error'))

    const driver = createCliDriver(sandbox.spawn('esw', ['build']))
    const error = await driver.waitForStderr()

    expect(error).toMatch(/could not resolve/i)
  })

  it('should clean dist first before next bundling start.', async () => {
    await sandbox.load(path.resolve(__dirname, 'fixtures/clean-dist'))

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

  it.each([
    [
      'cjs',
      'only-main-field',
      ['__esModule', 'module.exports'],
      [/^export\s/m]
    ],
    [
      'esm',
      'only-main-field-esm',
      [/^export\s/m],
      ['__esModule', 'module.exports']
    ]
  ] as const)(
    'should work with main field and %s format in fixtures(%s)',
    async (format, fixtureName, expects, unExpects) => {
      await sandbox.load(path.resolve(__dirname, `fixtures/${fixtureName}`))

      const driver = createCliDriver(
        sandbox.spawn('esw', ['build', `--format=${format}`])
      )

      const stdout = await driver.waitForStdout()
      expect(stdout).toContain('%')

      const [output] = await sandbox.loadBuildResult(['dist/index.js'])
      expects.forEach(ex => {
        if (ex instanceof RegExp) {
          expect(output).toMatch(ex)
        } else {
          expect(output).toContain(ex)
        }
      })
      unExpects.forEach(unEx => {
        if (unEx instanceof RegExp) {
          expect(output).not.toMatch(unEx)
        } else {
          expect(output).not.toContain(unEx)
        }
      })
    }
  )

  it.each([
    ['cjs', 'only-main-field-esm'],
    ['esm', 'only-main-field']
  ])(
    'should validate type field in package.json, current format %s, fixture: %s',
    async (format, fixtureName) => {
      await sandbox.load(path.resolve(__dirname, `fixtures/${fixtureName}`))

      const driver = createCliDriver(
        sandbox.spawn('esw', ['build', `--format=${format}`])
      )

      const stderr = await driver.waitForStderr()
      expect(stderr).toMatchSnapshot()
    }
  )

  it("shouldn't overwrite the esm format inference if only module field specific", async () => {
    await sandbox.load(path.resolve(__dirname, 'fixtures/only-module-field'))

    const driver = createCliDriver(
      sandbox.spawn('esw', ['build', '--format=cjs'])
    )

    const stdout = await driver.waitForStdout()
    expect(stdout).toContain('%')
    const [esmContent] = await sandbox.loadBuildResult(['dist/index.esm.js'])

    expect(esmContent).not.toContain('__esModule')
    expect(esmContent).not.toContain('module.exports')
    expect(esmContent).not.toContain('exports')
    expect(esmContent).toMatch(/^export\s/m)
  })

  // use node api to test that case
  it.todo('should emit bundling only once when we have multiple same out path.')

  it("should throw a error if package.json doesn't exists.", async () => {
    await sandbox.load(
      path.resolve(__dirname, 'fixtures/required-package.json')
    )

    const driver = createCliDriver(sandbox.spawn('esw', ['build']))

    const stderr = await driver.waitForStderr()
    expect(stderr).toContain('"package.json" is required')
  })

  it.each([
    [
      'if main and module field are unavailable',
      'no-valid-entry-field',
      ['build']
    ],
    [
      'if splitting = true, but format != esm',
      'no-options',
      ['build', '--splitting', '--format=cjs']
    ],
    [
      "if we aren't in watch mode but incremental = true",
      'no-options',
      ['build', '--incremental']
    ],
    ['if entryPoints.length is less than 1', 'empty-entry', ['build']]
  ])('should throw a error %s', async (_, name, args) => {
    await sandbox.load(path.resolve(__dirname, `fixtures/${name}`))
    const driver = createCliDriver(sandbox.spawn('esw', args))

    expect(
      (await driver.waitForStderr()).replace(sandbox.cwd, '<PRIVATE_PATH>')
    ).toMatchSnapshot()
  })

  it.each([
    [
      'if entry points are glob patterns',
      ['build', 'src/**/*.ts', '--outdir=dist'],
      ['dist/common/fib.js', 'dist/a.js', 'dist/b.js'],
      []
    ],
    [
      'if entry points are paths',
      ['build', 'src/a.ts', 'src/b.ts', '--outdir=dist'],
      ['dist/a.js', 'dist/b.js'],
      ['dist/common/fib.js']
    ],
    [
      'if entry points are glob patterns and paths',
      ['build', 'src/**/fib.ts', 'src/a.ts', '--outdir=dist'],
      ['dist/common/fib.js', 'dist/a.js'],
      ['dist/b.js']
    ]
  ])('should work %s', async (_, args, outputPaths, disallowPaths) => {
    await sandbox.load(path.resolve(__dirname, 'fixtures/multi-entries'))

    const driver = createCliDriver(sandbox.spawn('esw', args))

    expect(await driver.waitForStdout()).toContain('%')

    const contents = await sandbox.loadBuildResult(outputPaths)

    contents.forEach(content => {
      expect(content).toContain('function fib')
      expect(content).toContain('module.exports = ')
    })

    disallowPaths.forEach(p => {
      expect(fs.existsSync(p)).toBeFalsy()
    })
  })

  it('should work if extension is .cjs or .mjs', async () => {
    await sandbox.load(path.resolve(__dirname, 'fixtures/file-ext'))

    const driver = createCliDriver(sandbox.spawn('esw', ['build']))

    expect(await driver.waitForStdout()).toContain('%')

    const [cjs, esm] = await sandbox.loadBuildResult([
      'dist/index.cjs',
      'dist/index.mjs'
    ])

    expect(cjs).toContain('module.exports =')
    expect(esm).toMatch(/^export\s/m)
  })
})
