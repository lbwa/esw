export function fib(n: number): number {
  if (n < 2) {
    return n
  }
  let a = 0,
    b = 0,
    c = 1,
    i = 2

  while (i <= n) {
    i++
    a = b
    b = c
    c = a + b
  }
  return c
}
