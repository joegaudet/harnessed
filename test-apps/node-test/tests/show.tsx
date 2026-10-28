import { viewSearch } from '@harnessed-ts/conformance'
import type { View } from '@harnessed-ts/conformance'
import { App } from '@harnessed-ts/conformance/fixture'
import { dom } from '@harnessed-ts/dom'
import type { DomEnv } from '@harnessed-ts/dom'
import { cleanup, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach } from 'node:test'

// node:test has no globals, so Testing Library cannot register its own cleanup.
// It matters more than usual: a leaked previous tree makes strict single-target
// queries ambiguous.
afterEach(cleanup)

/** Puts a view on screen the way the Vitest + jsdom run does: same App, routed by `?view=`. */
export async function show(view: View): Promise<DomEnv> {
  window.history.pushState({}, '', `/${viewSearch(view)}`)
  const { baseElement } = render(<App />)
  return dom({ user: userEvent.setup(), container: baseElement })
}
