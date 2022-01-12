import fs from 'fs'
import path from 'path'
import { isDef, printBuildError, stdout } from '@eswjs/common'
import { BuildFailure, BuildOptions, BuildResult } from 'esbuild'
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

function createIgnoredFromOptions(group: BuildOptions[]) {
  return group.reduce((paths, options) => {
    const {
      entryPoints = {},
      absWorkingDir = process.cwd(),
      outdir = absWorkingDir,
      outExtension
    } = options
    return paths.concat(
      Object.keys(entryPoints as Record<string, string>).reduce(
        (paths, filename) => {
          const absOutDir = path.resolve(absWorkingDir, outdir)
          const serializedPath = path.resolve(
            absOutDir,
            `${filename}${
              (outExtension as NonNullable<BuildOptions['outExtension']>)['.js']
            }`
          )

          if (absOutDir !== absWorkingDir) {
            // ignore outPath dir
            paths.push(`${absOutDir.replace(/\/$/, '')}/**`)
          } else {
            // ignore output file
            paths.push(serializedPath)
          }
          return paths
        },
        [] as string[]
      )
    )
  }, [] as string[])
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

  const builder = Builder.new(cwd).inferOptions(
    isDef(options.incremental)
      ? options
      : Object.assign({ incremental: true }, options)
  )

  return combineLatest([builder.options$.pipe(toArray()), watch$]).pipe(
    tap(() => {
      stdout.clear()
      stdout.wait(
        `[${new Date().toLocaleTimeString()}] Watching for file changes in ${cwd}`
      )
    }),
    switchMap(([optionGroup, watch]) => {
      const ignored = IGNORED_DIR_WHEN_WATCHING.filter(Boolean).concat(
        createIgnoredFromOptions(optionGroup)
      )
      return (
        fromEvent(
          watch(cwd, {
            ignoreInitial: false,
            ignorePermissionErrors: true,
            ignored
          }),
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
    }),
    // reduce operator only emit values when source completed. We use it to handle all emit, but shouldn't completed during the file watching.
    reduce(
      (result, buildResults) =>
        buildResults.reduce((result, buildResult) => {
          if (!isDef(buildResult)) return result

          if (isFulfillResult(buildResult)) {
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