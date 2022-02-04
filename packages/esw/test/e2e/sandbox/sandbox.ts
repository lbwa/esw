import path from 'path'
import assert from 'assert'
import { format } from 'util'
import { ChildProcess, SpawnOptions } from 'child_process'
import fs from 'fs'
import os from 'os'
import { spawn, sync as spawnSync } from 'cross-spawn'
import stripAnsi from 'strip-ansi'
import { println } from './stdout'

export interface Sandbox {
  cwd: string
  load(directory: string): Promise<void>
  install(injectedDeps?: Record<string, string>): Promise<void>
  exists(path: string): Promise<boolean>
  patch(filepath: string, search: string, replacement: string): Promise<void>
  reset(): Promise<void>
  terminate(): Promise<void>
  spawn(command: string, args?: string[], options?: SpawnOptions): ChildProcess
}

export async function createSandbox() {
  const cwd = fs.realpathSync.native(
    await fs.promises.mkdtemp(path.resolve(os.tmpdir(), 'esw-e2e-'))
  )

  const childProcesses = new Set<ChildProcess>()

  async function copy(from: string, to: string) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    if (!(await sandbox.exists(to))) {
      await fs.promises.mkdir(to)
    }
    const elements = await fs.promises.readdir(from)
    await Promise.all(
      elements
        .filter(el => !el.includes('node_modules'))
        .map(async el => {
          if ((await fs.promises.lstat(path.join(from, el))).isFile()) {
            return fs.promises.copyFile(path.join(from, el), path.join(to, el))
          }
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          return copy(path.join(from, el), path.join(to, el))
        })
    )
  }
  const sandbox: Sandbox = {
    cwd,
    async load(directory) {
      return copy(directory, cwd)
    },

    async install(injectedDeps?: Record<string, string>) {
      println('Installing package dependencies ...')

      assert(
        await sandbox.exists('package.json'),
        format('package.json is required in %s.', cwd)
      )

      const packageJson = JSON.parse(
        await fs.promises.readFile(path.resolve(cwd, 'package.json'), 'utf8')
      ) as Record<string, string | Record<string, string>>

      await fs.promises.writeFile(
        path.resolve(cwd, 'package.json'),
        JSON.stringify(
          {
            ...packageJson,
            dependencies: {
              ...(packageJson.dependencies as Record<string, string>),
              ...injectedDeps
            }
          },
          null,
          2
        )
      )

      spawnSync('yarn', [], {
        stdio: 'inherit',
        cwd,
        env: { ...process.env }
      })

      println('Dependencies installed.')
    },

    async exists(p: string) {
      try {
        await fs.promises.access(path.resolve(cwd, p))
        return true
      } catch (error) {
        return false
      }
    },

    async patch(filepath, search, replacement) {
      const realPath = path.resolve(cwd, filepath)
      const content = await fs.promises.readFile(realPath, 'utf8')

      assert(
        content.includes(search),
        format('Couldn\'t find "%s" in the "%s".', search, filepath)
      )

      // wait for fs events to propagated
      await new Promise(r => setTimeout(r, 3e2))

      await fs.promises.writeFile(
        realPath,
        content.replace(search, replacement)
      )
    },

    async reset() {
      println('Resetting the sandbox.')

      await Promise.all(
        (
          await fs.promises.readdir(cwd)
        )
          .filter(dir => dir !== 'node_modules')
          .map(dir =>
            fs.promises.rm(path.resolve(cwd, dir), {
              recursive: true,
              force: true,
              maxRetries: 3
            })
          )
      )

      println('Sandbox reset.')
    },

    async terminate() {
      println('Cleaning up sandbox.')

      childProcesses.forEach(child => child.kill('SIGTERM'))

      await fs.promises.rm(cwd, {
        recursive: true,
        force: true,
        maxRetries: 3
      })

      println('Sandbox cleaned up.')
    },

    spawn(command, args = [], options = {}) {
      println(format('Spawning "%s %s" command ...', command, args.join(' ')))
      const childProcess = spawn(command, args, {
        cwd: cwd,
        env: { ...process.env },
        ...options
      })
      childProcess.stdout?.on('data', (data: Buffer) =>
        process.stdout.write(stripAnsi(data.toString()))
      )
      childProcess.stderr?.on('data', (data: Buffer) => {
        process.stderr.write(stripAnsi(data.toString()))
      })
      childProcess.on('exit', () => childProcesses.delete(childProcess))
      childProcesses.add(childProcess)
      return childProcess
    }
  }

  return sandbox
}
