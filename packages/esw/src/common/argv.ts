import arg, { ArgError } from 'arg'
import { concatMap, iif, map, Observable, of, throwError } from 'rxjs'

export function resolveArgv(
  argv: string[] = [],
  spec: arg.Spec,
  printUsage$: Observable<never>
) {
  const argv$ = of(argv)
  const resolvedArgv$ = argv$.pipe(
    map(argv => arg(spec, { argv, permissive: true })),
    concatMap(argv => {
      const unavailable = argv._?.filter(pending => pending.startsWith('-'))
      return iif(
        () => unavailable.length < 1,
        of(argv),
        throwError(
          () =>
            new ArgError(
              `Unknown arguments: ${unavailable.join(
                ', '
              )}. \nRun 'esw <command> --help' to print all available arguments.\n`,
              'ARG_UNKNOWN_OPTION'
            )
        )
      )
    })
  )

  return resolvedArgv$.pipe(
    concatMap(argv => iif(() => !!argv['--help'], printUsage$, of(argv)))
  )
}
