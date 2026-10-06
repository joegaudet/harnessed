// Values the demo's runs, the Cypress config and the recording scripts must
// agree on. Plain JS, so the node scripts import it as it is and the TypeScript
// side reads its types from it (tsconfig.json allowJs).

/**
 * Ports of the two servers the browser runs drive; no other app in the repo
 * uses them. package.json's serve:react and serve:ember spell them out too.
 */
export const PORTS = /** @type {const} */ ({ react: 5271, ember: 5272 })

/** The app's viewport in every browser run, and the size the RTL replay renders at. */
export const VIEWPORT = /** @type {const} */ ({ width: 520, height: 400 })

/** The Cypress runner's window: room for the command log and the app at full size, no more. */
export const CYPRESS_WINDOW = /** @type {const} */ ({ width: 1000, height: 750 })

/**
 * The Cypress runs' sync mark: a square of MARK_PX CSS pixels in the runner's
 * bottom-left corner, one colour per step, alternating, each held for at least
 * a step's pause. `scripts/record.mjs` tells exactly these two apart.
 */
export const MARK_PX = 24
export const MARK_COLORS = /** @type {const} */ (['#00ff00', '#ff00ff'])
