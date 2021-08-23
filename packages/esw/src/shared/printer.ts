import { isDef } from '@eswjs/common'
import { ProcessCode } from './constants'

export function printToTerminal(
  message: string,
  code: number = ProcessCode.ERROR,
  exit = false
) {
  if (code === ProcessCode.OK) {
    console.info(message)
  } else if (isDef(code)) {
    console.error(message)
  }
  if (exit) {
    process.exit(code)
  }
}
