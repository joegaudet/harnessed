import { PAGE_API_GLOBAL } from './global-name'
import { createPageApi } from './page-api'

/**
 * The injectable build's entry. Bundled as one self-contained IIFE — the
 * resolver, Testing Library, and core's error helpers — so a driver can drop it
 * into any page with no module loader present.
 */
// The page's own window, not `globalThis`: Firefox runs a WebDriver script in a
// sandbox whose global sits in front of the window and is not shared with the
// next script, so the API has to land where the page script looks it up.
const slot = (typeof window === 'undefined' ? globalThis : window) as unknown as Record<
  string,
  unknown
>
// A driver may inject once per call; installing once is enough.
if (!(PAGE_API_GLOBAL in slot)) slot[PAGE_API_GLOBAL] = createPageApi(document)
