export function fib(n: number) {
  let a = 0,
    b = 1
  while (n--) {
    const next = a + b
    a = b
    b = next
  }
  return a
}
