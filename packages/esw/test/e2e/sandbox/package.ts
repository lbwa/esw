import assert from 'assert'
import path from 'path'
import { format } from 'util'
import { exec } from 'child_process'
import fs from 'fs'
import { println } from './stdout'

export async function packLocalPackage(directory: string): Promise<string> {
  const packageJsonPath = path.resolve(directory, 'package.json')

  assert(
    fs.existsSync(packageJsonPath),
    format('"package.json" is required in %s', directory)
  )

  const { name, version } = JSON.parse(
    await fs.promises.readFile(packageJsonPath, 'utf8')
  ) as Record<string, string>

  const packedPath = path.resolve(directory, format('%s-%s.tgz', name, version))

  await fs.promises.rm(packedPath, { force: true, maxRetries: 3 })

  return new Promise<string>((resolve, reject) => {
    println(format('Packing local package in %s', packedPath))
    const childProcess = exec(
      'npm pack',
      {
        cwd: directory,
        env: { ...process.env }
      },
      // eslint-disable-next-line @typescript-eslint/naming-convention
      async (err, _stdout, stderr) => {
        if (err) return reject(new Error(stderr))

        assert(
          fs.existsSync(packedPath),
          format('pack local package failed: %s', packedPath)
        )

        println('Packed done')
        resolve(packedPath)
      }
    )

    childProcess.stdout?.on('data', (data: Buffer) =>
      process.stdout.write(data.toString())
    )
    childProcess.stderr?.on('data', (data: Buffer) =>
      process.stderr.write(data.toString())
    )
  })
}
