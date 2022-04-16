import { ExitCode, stdout, isDef } from '@eswjs/common'
import { defer, NEVER, map, switchMap } from 'rxjs'
import omit from 'lodash/omit'
import runWatch from './node'
import {
  EswWatchCommandSpec,
  EswWatchOptions,
  ESW_WATCH_OPTIONS_SPEC
} from './options'
import { CommandRunner } from '@cli/dispatch'
import { resolveArgv } from '@cli/argv'
import { Result } from '@root/cli/parser'

const watch: CommandRunner<ExitCode> = function (argv = []) {
  const handlePrintUsage$ = resolveArgv(
    argv,
    ESW_WATCH_OPTIONS_SPEC,
    defer(() => {
      stdout.raw(`
Description:
  watch working directory, run build again when files change

Usage
  esw watch [entry] [options]

  [entry] represents the library entry point.
          esw would run options inference when an entry files isn't explicitly specified.
          On the other hand, you should always specify a entry point explicitly when the main and module have a different basename.

  [options] esbuild options, see https://esbuild.github.io/

`)
      return NEVER
    })
  )

  const normalizedBuildArgs$ = handlePrintUsage$.pipe(
    map((args: Result<EswWatchCommandSpec>) => {
      args['--absWorkingDir'] ??= process.cwd()
      const entryPoints = args._.filter(pending => !pending.startsWith('-'))
      args['--entryPoints'] ??= entryPoints.length > 0 ? entryPoints : undefined
      return omit(args, '_')
    }),
    map(args =>
      (Object.keys(args) as (keyof typeof args)[]).reduce((options, key) => {
        const value = args[key]
        if (isDef(value)) {
          const name = key.replace(/^-+/, '') as keyof EswWatchOptions
          // @ts-ignore ___
          options[name] = value
        }
        return options
      }, {} as EswWatchOptions)
    )
  )

  return normalizedBuildArgs$.pipe(
    switchMap(options => runWatch(options)),
    map(() => ExitCode.OK)
  )
}

export default watch
