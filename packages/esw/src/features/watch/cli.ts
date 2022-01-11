import { ExitCode, stdout, isDef } from '@eswjs/common'
import { defer, NEVER, map, switchMap } from 'rxjs'
import arg from 'arg'
import omit from 'lodash/omit'
import { BuildOptions } from 'esbuild'
import { CommandRunner } from '../../cli/dispatch'
import { resolveArgv } from '../../cli/argv'
import { WatchArgsSpec, WATCH_ARGS_SPEC } from './cli-spec'
import runWatch from './node'

const watch: CommandRunner<ExitCode> = function (argv = []) {
  const handlePrintUsage$ = resolveArgv(
    argv,
    WATCH_ARGS_SPEC,
    defer(() => {
      stdout.raw(`
Description:
  watch files and run command when files change

Usage
  $ esw watch [options]
    
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
