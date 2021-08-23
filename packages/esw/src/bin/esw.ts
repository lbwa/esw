#!/usr/bin/env node
import { ProcessCode } from '../shared/constants'
import parse from '../parser/cli'
import { printToTerminal } from '../shared/printer'

parse(process.argv.slice(2)).subscribe({
  complete() {
    process.exit(ProcessCode.OK)
  },
  error(err: Error) {
    printToTerminal(err.message, ProcessCode.ERROR)
  }
})
