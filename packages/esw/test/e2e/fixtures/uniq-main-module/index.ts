import { fib } from './src/fib'

export default function (n: number) {
  if (n < 2) return n
  return fib(n)
}
