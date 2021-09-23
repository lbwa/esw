import fs from 'fs'
import { printBuildError, stdout, isDef } from '@eswjs/common'
import { BuildFailure, BuildOptions, BuildResult, Metafile } from 'esbuild'
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
  of,
  debounceTime,
  reduce
} from 'rxjs'
import cloneDeep from 'lodash/cloneDeep'
import { Build } from '../build/node'
import { isFulfillResult, writeToDiskSync } from '../common/utils'

type WatchEvent = 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'
/**
 * @see https://github.com/paulmillr/chokidar/blob/3.5.2/types/index.d.ts#L45
 */
type WatchListenerParams = readonly [WatchEvent, string, fs.Stats]

export default function runWatch(
  options: BuildOptions = {},
  cwd: string = options.absWorkingDir || process.cwd()
) {
  const watch$ = defer(() => import('chokidar')).pipe(
    map(({ default: { watch } }) => watch),
    catchError(() => {
      stdout.error("'chokidar' is required for file watching")
      return NEVER
    })
  )

  const build = new Build(options, cwd)

  return combineLatest([
    build.options$.pipe(
      last()
      // TODO: use filter(options => options.watch))
    ),
    watch$
  ]).pipe(
    tap(() => stdout.wait(`Watching for file changes in ${cwd}`)),
    switchMap(([options, watch]) => {
      return (
        fromEvent(
          watch([cwd], {
            ignoreInitial: true,
            ignorePermissionErrors: true,
            ignored: [
              `**/{${['.git', 'node_modules', options.outdir]
                .filter(Boolean)
                .join(',')}}/**`
            ]
          }),
          'all'
        ) as Observable<WatchListenerParams>
      ).pipe(
        debounceTime(1_00),
        tap(() => stdout.info('File change detected')),
        switchMap(() => build.run(of(options), false)),
        tap(() => stdout.info('Compilation done'))
      )
    }),
    // reduce operator only emit values when source completed. We use it to handle all emit, but shouldn't completed during the file watching.
    reduce((result, [buildResult]) => {
      if (!isDef(buildResult)) return result

      const builtRecord = new Set<string>()
      if (isFulfillResult(buildResult)) {
        const { outputFiles = [], metafile = {} as Metafile } =
          buildResult.value
        outputFiles.forEach(
          ({ path: outPath /* absolute path */, contents }) => {
            const destinationPath = build?.pathsMap
              ?.get(outPath)
              ?.find(item => !builtRecord.has(item))
            if (destinationPath) builtRecord.add(destinationPath)
            const destination =
              destinationPath ?? /* eg. splitted chunks */ outPath

            const cloned = cloneDeep(metafile)
            if (!outPath.endsWith(destination)) {
              const matchedDest = Object.keys(cloned.outputs).find(file =>
                outPath.endsWith(file)
              )
              if (matchedDest) {
                cloned.outputs[destination] = cloned.outputs[
                  matchedDest
                ] as NonNullable<Metafile['outputs'][string]>
                delete cloned.outputs[matchedDest]
              }
            }

            void writeToDiskSync(destination, contents)
          },
          [] as string[]
        )
        return result
      }

      const buildFailure = buildResult?.reason as BuildFailure
      if (isDef(buildFailure)) {
        printBuildError(buildFailure)
        return result
      }
      stdout.error('Unknown internal error, please file a issue.')
      return result
    }, [] as PromiseSettledResult<BuildResult>[])
  )
}
