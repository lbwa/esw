import { ChildProcess } from 'child_process'
import EventEmitter from 'events'
import { stdout } from '@eswjs/common'
import stripAnsi from 'strip-ansi'

export interface CliDriver {
  process: ChildProcess
  waitForStdout(timeout?: number): Promise<string>
  waitForStderr(timeout?: number): Promise<string>
}

const bus = new EventEmitter()

export function createCliDriver(process: ChildProcess): CliDriver {
  process.stdout?.on('data', (data: Buffer) => {
    bus.emit('stdout.next', stripAnsi(data.toString()))
  })
  process.stderr?.on('data', (data: Buffer) => {
    bus.emit('stderr.next', stripAnsi(data.toString()))
  })

  return {
    process,
    waitForStdout(timeout = 5e3) {
      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(
            new Error(
              stdout.colors.red.bold(
                'Exceeded time on waiting for no error message to appear.'
              )
            )
          )
          bus.removeAllListeners('stdout.next')
        }, timeout)

        bus.once('stdout.next', (stdout: string) => {
          clearTimeout(timer)
          resolve(stdout)
        })
      })
    },
    waitForStderr(timeout = 5e3) {
      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(
            new Error('Exceeded time on waiting for error message to appear.')
          )
          bus.removeAllListeners('stderr.next')
        }, timeout)

        bus.once('stderr.next', (stderr: string) => {
          clearTimeout(timer)
          resolve(stderr)
        })
      })
    }
  }
}
