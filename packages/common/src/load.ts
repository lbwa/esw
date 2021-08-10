/* eslint-disable @typescript-eslint/no-unsafe-return */
import { log } from '.'

function load<Dep>(name: string, baseDir: string, isDevDeps = false): Dep {
  try {
    return require(require.resolve(name, { paths: [baseDir] }))
  } catch (error) {
    log.error(
      `Couldn't find module ${name}, please ensure it has been installed. e.g. yarn add ${name} ${
        isDevDeps ? '-D' : ''
      }`
    )
    process.exit(1)
  }
}

export function loadDependency<Dep>(name: string, baseDir: string) {
  return load<Dep>(name, baseDir, false)
}
