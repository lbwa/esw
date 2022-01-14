export function assert(condition: unknown, message: string): asserts condition {
  if (condition) return
  throw new Error(message)
}

export function invariant<Condition>(
  condition: Condition,
  message: string
): asserts condition {
  if (process.env.NODE_ENV === 'development') {
    assert(condition, message)
  }
}
