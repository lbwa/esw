import isNil from 'lodash/isNil'

export function isDef<V>(value: V): value is NonNullable<V> {
  return !isNil(value)
}
