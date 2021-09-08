#!/usr/bin/env node
import { stdout } from '@eswjs/common'
import { ExitCode } from '../shared/constants'
import parse from '../parser/cli'

parse(process.argv.slice(2)).subscribe({
  complete() {
    process.exit(ExitCode.OK)
  },
  error(err: Error) {
    stdout.error(err.message)
    process.exit(ExitCode.ERROR)
  }
})
