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
    cleanBeforeBuild?: boolean,
    incremental?: boolean
  ): Observable<PromiseSettledResult<BuildResult>[]>
}

const MSG_SERVICE_UNAVAILABLE = `Couldn't invoke bundle service, because we need more information to do that.

  1) Perhaps you forgot to define the "main" and "module" fields in the "package.json" file if you want to bundle codebase with single entry-points.

  2) Perhaps you forgot to specify entry-points if you want to bundle codebase with multiple entry-points.
`

export function createBundleService(
  options$: Observable<BuildOptions>
): BuildService {
  const rebuilds: RebuildHandle[] = []

  function internalBuild(cleanBeforeBuild = false) {
    return options$.pipe(
      toArray(),
      mergeMap(async options => {
        assert(options.length > 0, MSG_SERVICE_UNAVAILABLE)

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
    build(cleanBeforeBuild = false, incremental = false) {
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
