import path from 'path'
import fsPromises from 'fs/promises'
import { BuildResult } from 'esbuild'

export function getTestName() {
  return expect.getState().currentTestName.replace(/\s/g, '-')
}

export function resolveFixture(name: string) {
  return path.resolve(__dirname, `./fixture/${name}`)
}

export function clearCacheDir(dir: string) {
  return fsPromises.rm(dir, { force: true, recursive: true })
}

export function formatBuildResult(raw: PromiseSettledResult<BuildResult>[]) {
  return raw.reduce((results, result) => {
    if (result.status === 'fulfilled') {
      const { warnings, errors } = result.value
      results.push({ warnings, errors })
    }
    return results
  }, [] as BuildResult[])
}

export function hasErrors(results: BuildResult[]) {
  return results.length > 1 && results.every(result => result.errors.length > 1)
}

export function hasWarnings(results: BuildResult[]) {
  return (
    results.length > 1 && results.every(result => result.warnings.length > 1)
  )
}
