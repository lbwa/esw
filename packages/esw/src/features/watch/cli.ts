import { ExitCode, stdout, isDef } from '@eswjs/common'
import { defer, NEVER, map, switchMap } from 'rxjs'
import arg from 'arg'
import omit from 'lodash/omit'
import { BuildOptions } from 'esbuild'
import { WatchArgsSpec, WATCH_ARGS_SPEC } from './cli-spec'
import runWatch from './node'
import { CommandRunner } from '@cli/dispatch'
import { resolveArgv } from '@cli/argv'

const watch: CommandRunner<ExitCode> = function (argv = []) {
  const handlePrintUsage$ = resolveArgv(
    argv,
    WATCH_ARGS_SPEC,
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
    map((args: arg.Result<WatchArgsSpec>) => {
      args['--absWorkingDir'] ??= process.cwd()
      const entryPoints = args._.filter(pending => !pending.startsWith('-'))
      args['--entryPoints'] ??= entryPoints.length > 0 ? entryPoints : undefined
      return omit(args, '_')
    }),
    map(args =>
      Object.keys(args).reduce((options, key) => {
        const value = args[key as keyof WatchArgsSpec]
        if (isDef(value)) {
          const name = key.replace(/^-+/, '') as keyof BuildOptions
          // @ts-expect-error mixed types
          options[name] = value as BuildOptions[keyof BuildOptions]
        }
        return options
      }, {} as BuildOptions)
    )
  )

  return normalizedBuildArgs$.pipe(
    switchMap(options => runWatch(options)),
    map(() => ExitCode.OK)
  )
}

export default watch
