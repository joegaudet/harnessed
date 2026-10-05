import type { Selector } from '@harnessed-ts/core'

/**
 * A `Selector` as it crosses into a remote page. Everything in one is JSON-safe
 * except a RegExp — `role('button', { name: /save/i })` — which WebDriver,
 * CDP and TestCafe all serialise to `{}`. This encodes them as tagged objects
 * on the way out, and the page API decodes them on the way in.
 */
export interface WireRegExp {
  $regexp: string
  flags: string
}

export type WireSelector = Record<string, unknown>

/**
 * Not `instanceof`: a selector built in the test process and handed to a page
 * in the same JS engine (jsdom, a same-origin frame) carries the other realm's
 * RegExp, which `instanceof` does not recognise.
 */
function isRegExp(value: unknown): value is RegExp {
  return Object.prototype.toString.call(value) === '[object RegExp]'
}

function encodeValue(value: unknown): unknown {
  if (isRegExp(value)) return { $regexp: value.source, flags: value.flags }
  if (Array.isArray(value)) return value.map(encodeValue)
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, encodeValue(inner)]),
    )
  }
  return value
}

function isWireRegExp(value: unknown): value is WireRegExp {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as WireRegExp).$regexp === 'string' &&
    typeof (value as WireRegExp).flags === 'string'
  )
}

function decodeValue(value: unknown): unknown {
  if (isRegExp(value)) return new RegExp(value.source, value.flags)
  if (isWireRegExp(value)) return new RegExp(value.$regexp, value.flags)
  if (Array.isArray(value)) return value.map(decodeValue)
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, decodeValue(inner)]),
    )
  }
  return value
}

export function encodeSelector(selector: Selector): WireSelector {
  return encodeValue(selector) as WireSelector
}

/** Idempotent: a selector that never left the process decodes to itself. */
export function decodeSelector(selector: Selector | WireSelector): Selector {
  return decodeValue(selector) as Selector
}
