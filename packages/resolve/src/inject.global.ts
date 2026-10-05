import { PAGE_API_GLOBAL } from './global-name'
import { createPageApi } from './page-api'

/**
 * The injectable build's entry. Bundled as one self-contained IIFE — the
 * resolver, Testing Library, and core's error helpers — so a driver can drop it
 * into any page with no module loader present.
 */
const slot = globalThis as Record<string, unknown>
// A driver may inject once per call; installing once is enough.
if (!(PAGE_API_GLOBAL in slot)) slot[PAGE_API_GLOBAL] = createPageApi(document)
