import { Component, computed, inject, input, linkedSignal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { NavigationEnd, Router, ROUTES } from '@angular/router'
import type { Routes } from '@angular/router'
import { defer, filter, map, of, startWith } from 'rxjs'
import type { Observable } from 'rxjs'
import { CardGrid } from './card-grid'
import type { CardSpec } from './card-grid'
import { DataScreen } from './data-screen'
import { FramedPanel } from './framed-panel'
import { LoginForm } from './login-form'
import { PortalDialog } from './portal-dialog'
import { StepOne, StepTwo } from './wizard'

export const CARDS: CardSpec[] = [
  { label: 'Small', hint: 'Under 1000 sq ft' },
  { label: 'Medium', hint: '1000 to 2500 sq ft' },
  { label: 'Large' },
]

/**
 * Every URL is this app: `?view=` and the pathname pick what it renders, as in
 * the React fixture, so the router only has to own the URL. A componentless
 * catch-all matches anything without rendering an outlet.
 */
export const FIXTURE_ROUTES: Routes = [{ path: '**', children: [] }]

/**
 * The Angular port of the conformance fixture's App: `?view=` picks the
 * component under test and the pathname picks the wizard step. It must render
 * the same tree as the React original — the fixture-parity test holds it to that.
 *
 * The URL is the `url` input when one is bound (a rendered view, the shape of a
 * component test), otherwise the router's (an app, or a test that provides the
 * router and navigates). Until either is known, nothing renders: a stage that
 * showed the default view first would be a view no spec asked for.
 */
@Component({
  selector: 'fixture-app',
  imports: [CardGrid, DataScreen, FramedPanel, LoginForm, PortalDialog, StepOne, StepTwo],
  template: `
    @if (location(); as at) {
      <div data-testid="stage">
        @if (view() === 'login') {
          <section data-testid="page-login">
            <form fixtureLoginForm [error]="error()" [lateDuplicates]="lateDuplicates()"></form>
          </section>
        }
        @if (view() === 'cards') {
          <section data-testid="page-cards">
            <div fixtureCardGrid [cards]="cards"></div>
            <!-- Same test id, outside the grid: a scope-dropping query finds this. -->
            <span data-testid="card-hint" data-test-card-hint="">decoy outside the grid</span>
          </section>
        }
        @if (view() === 'dialog') {
          <section data-testid="page-dialog">
            <div fixturePortalDialog></div>
          </section>
        }
        @if (view() === 'frame') {
          <section data-testid="page-frame">
            <div fixtureFramedPanel></div>
          </section>
        }
        @if (view() === 'data') {
          <section data-testid="page-data">
            <div fixtureDataScreen></div>
          </section>
        }
        @if (view() === 'wizard') {
          <section data-testid="page-wizard">
            @if (at.pathname === '/step-two') {
              <section fixtureStepTwo [token]="at.searchParams.get('token')"></section>
            } @else if (step() === 'two') {
              <section fixtureStepTwo token="in-page"></section>
            } @else {
              <section fixtureStepOne (next)="step.set('two')"></section>
            }
          </section>
        }
      </div>
    }
  `,
})
export class ConformanceApp {
  /** The path and query, e.g. `/step-two?token=abc`. Wins over the router's URL. */
  readonly url = input<string | undefined>()

  protected readonly cards = CARDS

  /** The router's URL after each navigation, or nothing when no router is provided. */
  private readonly routed = toSignal(
    inject(ROUTES, { optional: true }) === null ? of(undefined) : routerUrl(inject(Router)),
    { initialValue: undefined },
  )

  protected readonly location = computed(() => {
    const url = this.url() ?? this.routed()
    return url === undefined ? undefined : new URL(url, 'http://fixture.invalid')
  })

  protected readonly view = computed(() => this.location()?.searchParams.get('view') ?? 'wizard')
  protected readonly error = computed(() => this.location()?.searchParams.get('error') ?? undefined)
  protected readonly lateDuplicates = computed(
    () => this.location()?.searchParams.get('late') === '1',
  )

  /** Back to step one on every navigation, as the React fixture is on every page load. */
  protected readonly step = linkedSignal<URL | undefined, 'one' | 'two'>({
    source: this.location,
    computation: () => 'one',
  })
}

/** The URL each navigation ends at, starting from the current one if there is one yet. */
function routerUrl(router: Router): Observable<string | undefined> {
  return defer(() =>
    router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => router.url),
      startWith(router.navigated ? router.url : undefined),
    ),
  )
}
