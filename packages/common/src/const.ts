export const isEnvTest = process.env['NODE_ENV'] === 'test'

/**
 * @see https://nodejs.org/api/process.html#process_exit_codes
 */
export enum ExitCode {
  OK,
  ERROR
}

export const isWindows = process.platform === 'win32'
