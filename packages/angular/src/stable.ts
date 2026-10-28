import type { Injector } from '@angular/core'
import type { AngularEnv } from './env'

/**
 * The app's settle point: the fixture's `whenStable()` if there is one, else
 * the `ApplicationRef`'s. Zoneless, both wait for Angular's pending tasks — a
 * scheduled change detection, a navigation, an `HttpClient` request — and not
 * for a bare `setTimeout`, which a zoneless app does not track.
 */
export async function settle(env: AngularEnv): Promise<void> {
  await (env.fixture ?? env.app)?.whenStable()
}

/** Where the app's services live: the fixture's component injector, or the app's. */
export function injectorOf(env: AngularEnv): Injector {
  return (env.fixture?.componentRef.injector ?? env.app?.injector) as Injector
}
