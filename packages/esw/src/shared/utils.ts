export function isDef<V>(value: V): value is NonNullable<V> {
  return value !== null && value !== void 0
}

// https://github.com/microsoft/TypeScript/pull/39094#Spreads_in_array_literals
export function tuple<T extends unknown[]>(args: [...T]) {
  return args
}
