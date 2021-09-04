/* eslint-disable import/no-unresolved, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call */
// @ts-ignore unit test
import { fib } from './src/fib'

export default function (n: number) {
  if (n < 2) return n
  return fib(n)
}
