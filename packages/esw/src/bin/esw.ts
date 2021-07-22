#!/usr/bin/env node
import { ProcessCode } from '../shared/constants'
import cliParser$ from '../parser/cli'
import { printAndExit } from '../shared/log'

cliParser$.subscribe({
  complete() {
    process.exit(ProcessCode.OK)
  },
  error(err: Error) {
    printAndExit(err.message, ProcessCode.ERROR)
  }
})
