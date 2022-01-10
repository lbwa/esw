import fs from 'fs'
import path from 'path'
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
  of,
  debounceTime,
  reduce,
  first,
  exhaustMap
} from 'rxjs'
import cloneDeep from 'lodash/cloneDeep'
import { writeToDiskSync } from '../../utils/io'
import { Build } from '../build/node'
import { isFulfillResult } from '../../utils/data-structure'

type WatchEvent = 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'
/**
 * @see https://github.com/paulmillr/chokidar/blob/3.5.2/types/index.d.ts#L45
 */
type WatchListenerParams = readonly [WatchEvent, string, fs.Stats]

const IGNORED_DIR_WHEN_WATCHING = [
  '.git',
  '.husky',
  '.vscode',
  'node_modules'
].map(dir => `**/${dir}/**`)

export default function runWatch(
  options: BuildOptions = {},
  cwd: string = options.absWorkingDir || process.cwd()
) {
  const watch$ = defer(() => import('chokidar')).pipe(
    map(({ default: { watch } }) => watch),
    catchError((err: Error) => {
      stdout.error(
        "Couldn't load available file watcher, we got error:",
        err.message ?? err
      )
      return NEVER
    })
  )

  const build = new Build(
    isDef(options.incremental)
      ? options
      : Object.assign({ incremental: true }, options),
    cwd
  )

  return combineLatest([build.options$.pipe(first()), watch$]).pipe(
    tap(() => {
      stdout.clear()
      stdout.wait(
        `[${new Date().toLocaleTimeString()}] Watching for file changes in ${cwd}`
      )
    }),
    switchMap(([options, watch]) =>
      (
        fromEvent(
          watch([cwd], {
            ignoreInitial: false,
            ignorePermissionErrors: true,
            ignored: [
              `**/{${[
                ...IGNORED_DIR_WHEN_WATCHING,
                `${options.outdir}${options.outdir?.endsWith('*') ? '' : '/**'}`
              ]
                .filter(Boolean)
                .join(',')}}/**`
            ]
          }),
          'all'
        ) as Observable<WatchListenerParams>
      ).pipe(
        debounceTime(1_00),
        tap(([type, actionPath]) => {
          stdout.clear()
          stdout.wait(
            `${stdout.colors.dim(
              new Date().toLocaleTimeString()
            )} ${stdout.colors.green(type)} ${stdout.colors.dim(
              path.relative(cwd, actionPath) || '.'
            )}`
          )
        }),
        exhaustMap(() => build.run(of(options), false))
      )
    ),
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
      stdout.error(
        `Expect a successful or failed buildResult, but we go ${typeof buildResult}. This error is likely caused by a bug in esw. Please file a issue.`
      )
      return result
    }, [] as PromiseSettledResult<BuildResult>[])
  )
}
