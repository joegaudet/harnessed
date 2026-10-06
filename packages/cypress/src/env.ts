import type { EnvConfig } from '@harnessed-ts/core'
import { CYPRESS_DRIVER } from './driver-id'
// Imported for its side effect: constructing an env is the moment the driver has
// to be in the registry, and a bare re-export could be tree-shaken away.
import './cypress-query'
import './navigation'

export { CYPRESS_DRIVER }

export interface CypressEnv extends EnvConfig {
  readonly driver: typeof CYPRESS_DRIVER
  /**
   * The application under test's window — what `cy.window()` yields. That is the
   * AUT frame's WindowProxy, which stays the same object when the frame
   * navigates, so it is safe to hold across a `goto()`.
   */
  readonly window: Window
  /**
   * Where queries start. Read from `window` at every query unless it was pinned:
   * navigation replaces the document, and a query must never search the one the
   * frame has left.
   */
  readonly document: Document
  /**
   * Interactions go through Chrome DevTools Protocol input — trusted events from
   * the browser itself — instead of `@testing-library/user-event`. Chromium only.
   */
  readonly realEvents: boolean
  /** Whether each harness action writes an entry to Cypress's command log. */
  readonly log: boolean
}

export interface CypressEnvOptions {
  /** The AUT window: `cy.window()`'s subject. */
  window: Window
  /** Pins queries to one document. Omit it to follow the AUT through navigation. */
  document?: Document
  /** Trusted CDP input instead of user-event. Chromium only. Default `false`. */
  realEvents?: boolean
  /** Write each harness action to the command log. Default `true`. */
  log?: boolean
}

/**
 * Builds the env a harness is constructed with under Cypress. The commands in
 * `@harnessed-ts/cypress/support` build it for you; call this directly only when
 * you already hold the AUT window.
 */
export function cypress({
  window,
  document,
  realEvents = false,
  log = true,
}: CypressEnvOptions): CypressEnv {
  return {
    driver: CYPRESS_DRIVER,
    window,
    get document(): Document {
      return document ?? window.document
    },
    realEvents,
    log,
  }
}
