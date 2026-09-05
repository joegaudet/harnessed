/**
 * The list operations, written once.
 *
 * `Query` and `ComponentHarness` both expose `nth`/`first`/`last`/`each`/`map`/
 * `filter` over "N of these on screen". The algorithm is identical; only what
 * `nth` returns differs. Keeping two copies meant a fix like the empty-list case
 * below had to be made — and remembered — twice.
 */
export interface Indexable<T> {
  count(): Promise<number>
  nth(index: number): T
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
  source: Indexable<T>,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  const total = await source.count()
  // Sequential on purpose: callbacks interact with the page, and order is part
  // of the contract.
  for (let index = 0; index < total; index += 1) {
    await fn(source.nth(index), index)
  }
}

export async function mapOf<T, R>(
  source: Indexable<T>,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  await eachOf(source, async (item, index) => {
    results.push(await fn(item, index))
  })
  return results
}

export async function filterOf<T>(
  source: Indexable<T>,
  fn: (item: T, index: number) => Promise<boolean>,
): Promise<T[]> {
  const kept: T[] = []
  await eachOf(source, async (item, index) => {
    if (await fn(item, index)) kept.push(item)
  })
  return kept
}
