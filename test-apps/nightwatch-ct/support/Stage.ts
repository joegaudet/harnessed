import { App } from '@harnessed-ts/conformance/fixture'
import { createElement, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

declare global {
  interface Window {
    /** Renders the fixture for a view's query string, synchronously. */
    __harnessedShow?: (search: string) => void
  }
}

/**
 * What `browser.mountComponent` mounts. It renders no fixture until a spec
 * names its view: mounting takes the plugin a few hundred milliseconds after the
 * component renders, and the catalog's late nodes arrive 150ms after the
 * fixture's stage. So the stage mounts empty, and `show()` renders the view
 * once mounting is done, then waits for the stage the way the e2e runs do.
 *
 * The fixture reads its view from the URL, so only the query string of the
 * renderer page changes; its path stays the plugin's.
 */
export default function Stage() {
  const [key, setKey] = useState<number | null>(null)
  useEffect(() => {
    let renders = 0
    window.__harnessedShow = search => {
      window.history.replaceState(null, '', `${window.location.pathname}${search}`)
      flushSync(() => setKey(++renders))
    }
    return () => {
      delete window.__harnessedShow
    }
  }, [])
  // The plugin reports a mount as failed when the root renders no element.
  return createElement(
    'div',
    { 'data-harnessed-ct': '' },
    key === null ? null : createElement(App, { key }),
  )
}
