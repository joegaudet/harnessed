import { inputBinding } from '@angular/core'
import type { ComponentFixture } from '@angular/core/testing'
import { provideRouter, Router } from '@angular/router'
import { viewSearch } from '@harnessed-ts/conformance'
import type { ConformanceCtx, View } from '@harnessed-ts/conformance'
import { angular } from '@harnessed-ts/angular'
import type { AngularEnv } from '@harnessed-ts/angular'
import { render } from '@testing-library/angular/zoneless'
import { ConformanceApp, FIXTURE_ROUTES } from '../src/app/fixture/conformance-app'

/**
 * Renders the app at `url` the way a component test renders a component: the
 * URL is an input, and there is no router. Resolves once the app is stable.
 */
export async function renderAt(url: string): Promise<ComponentFixture<ConformanceApp>> {
  const { fixture } = await render(ConformanceApp, {
    bindings: [inputBinding('url', () => url)],
    waitForStableOnRender: true,
  })
  return fixture
}

/** A view on screen, rendered: the whole catalog runs this way. */
export const rendered: ConformanceCtx = {
  async show(view: View): Promise<AngularEnv> {
    return angular({ fixture: await renderAt(`/${viewSearch(view)}`) })
  },
}

/**
 * The app with the router provided, and nothing navigated yet: the shape of a
 * test that drives an app through its routes. `goto()` works here.
 */
export async function renderRouted(): Promise<AngularEnv> {
  const { fixture } = await render(ConformanceApp, {
    providers: [provideRouter(FIXTURE_ROUTES)],
    waitForStableOnRender: true,
  })
  return angular({ fixture })
}

/** A view on screen, reached through the router rather than an input. */
export const routed: ConformanceCtx = {
  async show(view: View): Promise<AngularEnv> {
    const env = await renderRouted()
    await env.fixture?.componentRef.injector.get(Router).navigateByUrl(`/${viewSearch(view)}`)
    await env.fixture?.whenStable()
    return env
  },
}
