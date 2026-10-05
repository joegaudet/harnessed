import { createPageApi, PAGE_API_GLOBAL } from './page-api'

/**
 * The injectable build's entry. Bundled as one self-contained IIFE — the
 * resolver, Testing Library, and core's error helpers — so a driver can drop it
 * into any page with no module loader present.
 */
;(globalThis as Record<string, unknown>)[PAGE_API_GLOBAL] = createPageApi(document)
