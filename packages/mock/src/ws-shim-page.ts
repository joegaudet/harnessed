/**
 * The WebSocket shim as a page script, bundled into text (see tsup.config.ts)
 * for `wsShimScript`, which binds the name it posts through.
 */
import { wsShim } from './ws-shim'

declare const __HARNESSED_WS_POST__: string

wsShim(__HARNESSED_WS_POST__)
