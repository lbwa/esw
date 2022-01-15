import { build, BuildOptions, BuildResult } from 'esbuild'
import { map, tap, mergeMap, toArray, from, Observable } from 'rxjs'
import { assert } from '@eswjs/common'
import isFunction from 'lodash/isFunction'
import isEmpty from 'lodash/isEmpty'
import { rmDirs } from '../utils/io'
import { isFulfillResult } from '../utils/data-structure'
import { findAllStaleDir } from './io'

type RebuildHandle = NonNullable<BuildResult['rebuild']>

export class BundleService {
  private rebuilds: RebuildHandle[] = []

  static new(...payload: ConstructorParameters<typeof BundleService>) {
    return new BundleService(...payload)
  }

  constructor(private readonly options$: Observable<BuildOptions>) {}

  incrementalBuild(
    ...payload: Parameters<BundleService['build']>
  ): ReturnType<BundleService['build']> {
    if (!isEmpty(this.rebuilds)) {
      return from(Promise.allSettled(this.rebuilds.map(rebuild => rebuild())))
    }

    return this.build(...payload).pipe(
      tap(results => {
        results.forEach(result => {
          // only works with option.incremental: true
          if (isFulfillResult(result) && isFunction(result.value?.rebuild)) {
            this.rebuilds.push(result.value.rebuild)
          }
        })
      })
    )
  }

  build(cleanBeforeBuild = true) {
    const run$ = this.options$.pipe(
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
    return run$
  }
}
