export function isDef<V>(value: V): value is NonNullable<V> {
  return value !== null && value !== void 0
}
