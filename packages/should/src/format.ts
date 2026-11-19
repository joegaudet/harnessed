/** A value as a failure message prints it: strings quoted, structures as JSON. */
export function show(value: unknown): string {
  if (value === undefined) return 'undefined'
  if (typeof value === 'function') return value.name === '' ? 'a function' : value.name
  if (typeof value === 'bigint') return `${value}n`
  if (typeof value === 'symbol' || value instanceof RegExp) return String(value)
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) return `${value.name}: ${value.message}`
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    // Circular structures cannot be stringified.
    return String(value)
  }
}

/** Structural equality: arrays, plain objects, Map, Set, Date and RegExp by content. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false
  if (a instanceof Date) return a.getTime() === (b as Date).getTime()
  if (a instanceof RegExp) return String(a) === String(b)
  if (a instanceof Map) {
    const other = b as Map<unknown, unknown>
    return (
      a.size === other.size &&
      [...a].every(([key, value]) => other.has(key) && deepEqual(value, other.get(key)))
    )
  }
  if (a instanceof Set) {
    const other = [...(b as Set<unknown>)]
    return a.size === other.length && [...a].every(item => other.some(o => deepEqual(item, o)))
  }
  const keys = Object.keys(a)
  const otherKeys = Object.keys(b)
  if (keys.length !== otherKeys.length) return false
  return keys.every(
    key =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  )
}

/** `length` of a string or array, `size` of a Map or Set, otherwise undefined. */
export function sizeOf(value: unknown): number | undefined {
  if (typeof value === 'string' || Array.isArray(value)) return value.length
  if (value instanceof Map || value instanceof Set) return value.size
  return undefined
}
