import path from 'path'
import fsPromises from 'fs/promises'
import pick from 'lodash/pick'
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

export function formatBuildResult(
  raw: PromiseSettledResult<BuildResult>[],
  fulfilledResultFilter = (result: BuildResult) =>
    pick(result, 'warnings', 'errors')
) {
  return raw.reduce((results, result) => {
    if (result.status === 'fulfilled') {
      results.push(fulfilledResultFilter(result.value))
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
