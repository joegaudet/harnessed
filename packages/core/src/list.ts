/**
 * The list operations, written once.
 *
 * `Query` and `ComponentHarness` both expose `each`/`map`/`filter` over "N of
 * these on screen". The algorithm is identical; only what an item *is* differs.
 * Keeping two copies meant a fix had to be made — and remembered — twice.
 *
 * Everything goes through `all()` so a driver can resolve the whole list in one
 * pass instead of once per element; the naive count-then-index form lives in each
 * class's default `all()`.
 */
export interface Listable<T> {
  all(): Promise<T[]>
}

/**
 * The last index, or `undefined` when nothing matched.
 *
 * Without this, `last()` on an empty set asks for index `-1`, which the two
 * drivers read differently: Testing Library reports an out-of-range index, while
 * Playwright's `nth(-1)` means *the last one* and waits out the whole timeout on
 * a set that will never have members.
 */
export function lastIndex(total: number): number | undefined {
  return total === 0 ? undefined : total - 1
}

export async function eachOf<T>(
  source: Listable<T>,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const items = await source.all()
  // Sequential on purpose: callbacks interact with the page, and order is part
  // of the contract.
  for (const [index, item] of items.entries()) {
    await fn(item, index)
  }
}

export async function mapOf<T, R>(
  source: Listable<T>,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  await eachOf(source, async (item, index) => {
    results.push(await fn(item, index))
  })
  return results
}

export async function filterOf<T>(
  source: Listable<T>,
  fn: (item: T, index: number) => Promise<boolean>,
): Promise<T[]> {
  const kept: T[] = []
  await eachOf(source, async (item, index) => {
    if (await fn(item, index)) kept.push(item)
  })
  return kept
}
