import { build, BuildOptions, BuildResult } from 'esbuild'
import { map, tap, mergeMap, toArray, from, Observable } from 'rxjs'
import { assert } from '@eswjs/common'
import isFunction from 'lodash/isFunction'
import isEmpty from 'lodash/isEmpty'
import { isFulfillResult } from '../utils/data-structure'
import { rmDirs, findAllStaleDir } from '@root/io'

type RebuildHandle = NonNullable<BuildResult['rebuild']>
export interface BuildService {
  build(
    cleanBeforeBuild: boolean,
    incremental?: boolean
  ): Observable<PromiseSettledResult<BuildResult>[]>
}

export function createBundleService(options$: Observable<BuildOptions>) {
  const rebuilds: RebuildHandle[] = []

  function internalBuild(cleanBeforeBuild = true) {
    return options$.pipe(
      toArray(),
      mergeMap(async options => {
        assert(
          options.length > 0,
          'Invalid operation. Maybe you forgot to define the main or module field in the package.json file.'
        )

        if (cleanBeforeBuild) {
          await rmDirs(await findAllStaleDir(options))
        }

        return options
      }),
      map(options => options.map(options => build(options))),
      mergeMap(handles => Promise.allSettled(handles))
    )
  }

  return {
    build(cleanBeforeBuild = true, incremental = false) {
      if (!incremental) {
        return internalBuild(cleanBeforeBuild)
      }

      if (!isEmpty(rebuilds)) {
        return from(Promise.allSettled(rebuilds.map(rebuild => rebuild())))
      }

      return internalBuild(cleanBeforeBuild).pipe(
        tap(results => {
          results.forEach(result => {
            // only works with option.incremental: true
            if (isFulfillResult(result) && isFunction(result.value?.rebuild)) {
              rebuilds.push(result.value.rebuild)
            }
          })
        })
      )
    }
  }
}
