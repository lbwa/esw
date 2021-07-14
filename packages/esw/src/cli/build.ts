import arg from 'arg'
import {
  EMPTY,
  iif,
  of,
  switchMap,
  switchMapTo,
  tap,
  map,
  catchError,
  throwError
} from 'rxjs'
import { printAndExit, error } from '../shared/log'
import { ProcessCode } from '../shared/constants'
import { CommandRunner } from '../cli-parser'

function createPrintHelp(code = ProcessCode.OK) {
  return of(code).pipe(
    tap(code =>
      printAndExit(
        `
    Description
      Compiles the codebase for package publish

    Usage
      $ esw build <entry files>

    <entry files> represents the library entry points.
`,
        code
      )
    ),
    switchMapTo(EMPTY)
  )
}

const build: CommandRunner = function (argv = []) {
  const availableArgs: arg.Spec = {
    '--help': Boolean,

    // alias
    '-h': '--help'
  }

  of(argv)
    .pipe(
      map(argv => arg(availableArgs, { argv, permissive: true })),
      catchError((err: Error & { code: string }) => {
        if (err.code === 'ARG_UNKNOWN_OPTION') {
          return createPrintHelp(ProcessCode.ERROR).pipe(switchMapTo(EMPTY))
        }
        return throwError(() => err)
      }),
      switchMap(args =>
        iif(() => !!args['--help'], createPrintHelp(), of(args))
      ),
      tap(args => console.log(`args`, args))
    )
    .subscribe({
      error(err: Error) {
        error(`> Build error occurred`)
        printAndExit(err.message, ProcessCode.ERROR)
      },
      complete() {
        process.exit(ProcessCode.OK)
      }
    })
}

export default build
