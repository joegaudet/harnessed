/** Every refusal a page raises, stated once so the wording is the same under every driver. */

export function noPath(name: string): Error {
  return new Error(
    `harnessed: ${name} declares no path, so goto() cannot navigate to it. ` +
      'Override `get path()`, or reach the page by interaction and await expectReady().',
  )
}

/** The page's own readiness check gave up. The original failure travels as `cause`. */
export function notReady(name: string, cause: unknown): Error {
  const reason = cause instanceof Error ? cause.message : String(cause)
  return new Error(`harnessed: ${name} did not become ready. ${reason}`, { cause })
}

/** The page's URL members would read and drive the embedding page, not the frame. */
export function nestedInFrame(name: string): Error {
  return new Error(
    `harnessed: ${name} is nested in a frame, so its URL members would act on the ` +
      'page around it. Navigate the embedding page instead.',
  )
}

/** The caller's explicit timeout elapsed before the readiness check resolved. */
export function notReadyWithin(name: string, timeout: number): Error {
  return new Error(`harnessed: ${name} did not become ready within ${timeout}ms.`)
}
