import { getConfig } from './config'

/**
 * Pushes the configured test-id attribute into whichever library actually
 * resolves the query.
 *
 * Both Testing Library and Playwright keep this in their own module-level state,
 * so it has to be pushed across rather than passed per query. Done lazily at
 * query time because `configure()` may be called after the driver was imported,
 * and memoised because the common case is that nothing changed.
 */
export function testIdSync(apply: (attribute: string) => void): () => void {
  let applied: string | undefined
  return () => {
    const wanted = getConfig().testIdAttribute
    if (wanted !== applied) {
      apply(wanted)
      applied = wanted
    }
  }
}
