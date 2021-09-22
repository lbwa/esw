import fs from 'fs'
import { stdout } from '@eswjs/common'
import { BuildOptions } from 'esbuild'
import {
  catchError,
  combineLatest,
  defer,
  fromEvent,
  map,
  NEVER,
  Observable,
  switchMap,
  tap,
  last,
  of
} from 'rxjs'
import { Build } from '../build/node'

type WatchEvent = 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'
/**
 * @see https://github.com/paulmillr/chokidar/blob/3.5.2/types/index.d.ts#L45
 */
type WatchListenerParams = readonly [WatchEvent, string, fs.Stats]

export default async function runWatch(
  options: BuildOptions = {},
  cwd: string = options.absWorkingDir || process.cwd()
) {
  let done: () => void
  const handler = new Promise<void>(resolve => {
    done = resolve
  })

  const watch$ = defer(() => import('chokidar')).pipe(
    map(({ default: { watch } }) => watch),
    catchError(() => {
      stdout.error("'chokidar' is required for file watching")
      return NEVER
    })
  )

  const build = new Build(options, cwd)

  combineLatest([
    build.options$.pipe(
      last()
      // TODO: use filter(options => options.watch))
    ),
    watch$
  ])
    .pipe(
      tap(() => stdout.wait(`Watching for file changes in ${cwd}`)),
      switchMap(([options, watch]) => {
        return (
          fromEvent(
            watch([cwd], {
              ignoreInitial: true,
              ignorePermissionErrors: true,
              ignored: ['**/{.git,node_modules}/**', options.outdir]
            }),
            'all'
          ) as Observable<WatchListenerParams>
        ).pipe(map(() => build.run(of(options))))
      }),
      map(data => {
        // TODO: write to disk
        return data
      })
    )
    .subscribe({
      next: () => stdout.wait('File change detected'),
      error: error => stdout.error(error),
      complete: () => {
        stdout.info('Teardown file watching')
        done?.()
      }
    })

  return handler
}
