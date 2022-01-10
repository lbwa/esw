// https://github.com/microsoft/TypeScript/pull/39094#Spreads_in_array_literals
export function tuple<T extends unknown[]>(args: [...T]) {
  return args
}

export function isFulfillResult<Data>(
  result: PromiseSettledResult<Data>
): result is PromiseFulfilledResult<Data> {
  return result.status === 'fulfilled'
}
