import path from 'path'
import fs from 'fs'
import { of, iif, map, throwError } from 'rxjs'
import { PackageJson } from 'type-fest'

export function resolvePackageJson(cwd: string) {
  const resolvedPkgJsonPath = path.resolve(cwd, 'package.json')
  const pkgJsonPath$ = of(resolvedPkgJsonPath)
  const resolve$ = pkgJsonPath$.pipe(
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    map(pkgJsonPath => require(pkgJsonPath) as PackageJson)
  )
  return iif(
    () => fs.existsSync(resolvedPkgJsonPath),
    resolve$,
    throwError(
      () =>
        new Error(
          `package.json file doesn't exists in the ${resolvedPkgJsonPath}`
        )
    )
  )
}
