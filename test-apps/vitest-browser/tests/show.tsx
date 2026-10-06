import { viewSearch } from '@harnessed-ts/conformance'
import type { View } from '@harnessed-ts/conformance'
import { App } from '@harnessed-ts/conformance/fixture'
import { vitestBrowser } from '@harnessed-ts/vitest-browser'
import type { VitestBrowserEnv } from '@harnessed-ts/vitest-browser'
import { cleanup, render } from 'vitest-browser-react/pure'
import { afterEach } from 'vitest'

// The pure entry registers no hooks of its own, so cleanup is explicit. It matters
// more than usual: a leaked previous tree makes strict single-target queries
// ambiguous.
afterEach(cleanup)

/** Puts a view on screen the way the jsdom run does: same App, routed by `?view=`. */
export async function show(view: View): Promise<VitestBrowserEnv> {
  window.history.pushState({}, '', `/${viewSearch(view)}`)
  // A fresh container per test, but queries start at the body: the dialog
  // portals out of the container, exactly as it would in an app.
  const { baseElement } = await render(<App />)
  return vitestBrowser({ container: baseElement })
}
