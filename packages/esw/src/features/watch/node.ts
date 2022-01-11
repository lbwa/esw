import fs from 'fs'
import path from 'path'
import { isDef, printBuildError, stdout } from '@eswjs/common'
import { BuildFailure, BuildOptions, BuildResult, Metafile } from 'esbuild'
import cloneDeep from 'lodash/cloneDeep'
import {
  catchError,
  combineLatest,
  debounceTime,
  defer,
  exhaustMap,
  fromEvent,
  map,
  NEVER,
  Observable,
  reduce,
  switchMap,
  tap,
  toArray
} from 'rxjs'
import { isFulfillResult } from '../../utils/data-structure'
import { writeToDiskSync } from '../../utils/io'
import { Builder } from '../build/node'

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

function resolveEntryPoints(
  { entryPoints = [] }: BuildOptions,
  cwd = process.cwd()
): string[] {
  if (!Array.isArray(entryPoints)) {
    return resolveEntryPoints({ entryPoints: Object.values(entryPoints) }, cwd)
  }
  return entryPoints.map(entry => path.resolve(cwd, entry))
}

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

  const serializedBuildOptions = isDef(options.incremental)
    ? options
    : Object.assign({ incremental: true }, options)
  const builder = Builder.new(cwd).inferOptions(serializedBuildOptions)

  return combineLatest([builder.options$.pipe(toArray()), watch$]).pipe(
    tap(() => {
      stdout.clear()
      stdout.wait(
        `[${new Date().toLocaleTimeString()}] Watching for file changes in ${cwd}`
      )
    }),
    switchMap(([optionGroup, watch]) =>
      (
        fromEvent(
          watch(
            optionGroup.map(options => resolveEntryPoints(options)).flat(),
            {
              ignoreInitial: false,
              ignorePermissionErrors: true,
              ignored: IGNORED_DIR_WHEN_WATCHING.filter(Boolean)
            }
          ),
          'all'
        ) as Observable<WatchListenerParams>
      ).pipe(
        debounceTime(1_00),
        tap(([type, actionPath]) => {
          stdout.wait(
            `${stdout.colors.dim(
              new Date().toLocaleTimeString()
            )} ${stdout.colors.green(type)} ${stdout.colors.dim(
              path.relative(cwd, actionPath) || '.'
            )}`
          )
        }),
        exhaustMap(() => builder.build(false))
      )
    ),
    // reduce operator only emit values when source completed. We use it to handle all emit, but shouldn't completed during the file watching.
    reduce(
      (result, buildResults) =>
        buildResults.reduce((result, buildResult) => {
          if (!isDef(buildResult)) return result

          const builtRecord = new Set<string>()
          if (isFulfillResult(buildResult)) {
            const { outputFiles = [], metafile = {} as Metafile } =
              buildResult.value
            outputFiles.forEach(
              ({ path: outPath /* absolute path */, contents }) => {
                const destinationPath = builder?.pathsMap
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
        }, result),
      [] as PromiseSettledResult<BuildResult>[]
    )
  )
}
