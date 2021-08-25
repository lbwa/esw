import { isDef } from '@eswjs/common'
import { ProcessCode } from './constants'

export function printToTerminal(
  message: string,
  code: number = ProcessCode.ERROR,
  exit = false
) {
  if (code === ProcessCode.OK) {
    process.stdout.write(message)
  } else if (isDef(code)) {
    process.stderr.write(message)
  }
  if (exit) {
    process.exit(code)
  }
}
