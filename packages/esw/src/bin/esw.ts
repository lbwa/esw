#!/usr/bin/env node
import { ProcessCode } from '../shared/constants'
import cliParser$ from '../cli-parser'
import { printAndExit } from '../shared/log'

cliParser$.subscribe({
  complete() {
    process.exit(ProcessCode.OK)
  },
  error(err: Error) {
    printAndExit(err.message, ProcessCode.ERROR)
  }
})
