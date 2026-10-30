import { modifier } from 'ember-modifier'

/**
 * Gives each section heading (h2, h3 with an id) a link to itself, so a section can be shared,
 * then scrolls to the heading `hash` names. Pages render after the browser has already tried
 * the hash, so without this a link like `installation.md#required-setup` lands at the top. Returns whether
 * the hash's target was there to scroll to.
 */
export function linkHeadings(element: HTMLElement, hash: string): boolean {
  for (const heading of element.querySelectorAll<HTMLElement>('h2[id], h3[id]')) {
    if (heading.querySelector('a.heading-anchor')) continue
    const link = document.createElement('a')
    link.className = 'heading-anchor'
    link.href = `#${heading.id}`
    link.setAttribute('aria-label', `Link to “${heading.textContent?.trim()}”`)
    link.textContent = '#'
    heading.append(link)
  }
  const id = decodeURIComponent(hash.slice(1))
  const target = id ? element.querySelector(`[id="${CSS.escape(id)}"]`) : null
  target?.scrollIntoView()
  return Boolean(target)
}

/**
 * Runs once the page's prose is in the DOM, and again as parts of it render later (API docs,
 * examples): their headings get links too, and the hash scrolls once its target appears.
 */
export const headingAnchors = modifier((element: HTMLElement) => {
  let hash = window.location.hash
  const run = () => {
    if (linkHeadings(element, hash)) hash = ''
  }
  // Adding a link is itself a mutation, but the second pass finds nothing new and stops.
  const observer = new MutationObserver(run)
  observer.observe(element, { childList: true, subtree: true })
  run()
  return () => observer.disconnect()
})
