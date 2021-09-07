import { isDef } from '@eswjs/common'
import { ExitCode } from './constants'

export function printToTerminal(
  message: string,
  code: number = ExitCode.OK,
  exit = false
) {
  if (code === ExitCode.OK) {
    process.stdout.write(message)
  } else if (isDef(code)) {
    process.stderr.write(message)
  }
  if (exit) {
    process.exit(code)
  }
}
