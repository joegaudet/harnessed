import type { EnvConfig } from '@harnessed/core'
import type { UserEvent } from '@testing-library/user-event'
import { DOM_DRIVER } from './driver-id'
// Imported for its side effect: constructing an env is the moment the driver has
// to be in the registry, and a bare re-export could be tree-shaken away.
import './dom-query'

export { DOM_DRIVER }

export interface DomEnv extends EnvConfig {
  readonly driver: typeof DOM_DRIVER
  /** A `userEvent.setup()` result. Interactions go through it, not fireEvent. */
  readonly user: UserEvent
  /**
   * Where queries start. Defaults to `document.body`. Pass the `baseElement` from a
   * render result to scope a harness to one tree — which is what makes two
   * instances in one test, and portals, work without a cleanup race.
   */
  readonly container: HTMLElement
}

export interface DomEnvOptions {
  user: UserEvent
  container?: HTMLElement
}

/** Builds the env a harness is constructed with under Testing Library. */
export function dom({ user, container }: DomEnvOptions): DomEnv {
  return {
    driver: DOM_DRIVER,
    user,
    container: container ?? document.body,
  }
}
