import { debuglog } from 'util'
import { concatMap, iif, map, Observable, of, tap } from 'rxjs'
import { CliSpec, createCliParser } from './parser'

const debug = debuglog('esw:argv')

export function resolveArgv<Spec extends CliSpec>(
  argv: string[] = [],
  spec: Spec,
  printUsage$: Observable<never>
) {
  const argv$ = of(argv)
  const resolvedArgv$ = argv$.pipe(
    map(argv => createCliParser(argv).parse(spec))
  )

  return resolvedArgv$.pipe(
    concatMap(argv => iif(() => !!argv['--help'], printUsage$, of(argv))),
    tap(result => debug('%o', result))
  )
}
