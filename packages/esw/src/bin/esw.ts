#!/usr/bin/env node
import { stdout, ExitCode } from '@eswjs/common'
import parse from '../cli/dispatch'

parse(process.argv.slice(2)).subscribe({
  complete() {
    process.exit(ExitCode.OK)
  },
  error(err: Error) {
    stdout.error(err.message)
    process.exit(ExitCode.ERROR)
  }
})
