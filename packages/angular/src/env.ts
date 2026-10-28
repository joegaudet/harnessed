import type { ApplicationRef, ComponentRef } from '@angular/core'
import type { EnvConfig } from '@harnessed-ts/core'
import { ANGULAR_DRIVER } from './driver-id'
// Imported for their side effects: constructing an env is the moment the driver
// has to be in the registry, and a bare re-export could be tree-shaken away.
import './angular-query'
import './navigation'

export { ANGULAR_DRIVER }

/**
 * What the driver needs of a `ComponentFixture`: a structural type, so a
 * fixture from TestBed, `@testing-library/angular` or `cypress/angular` all
 * fit, and nothing here imports `@angular/core/testing` at runtime.
 */
export interface AngularFixture {
  whenStable(): Promise<unknown>
  readonly componentRef: Pick<ComponentRef<unknown>, 'injector'>
}

export interface AngularEnv extends EnvConfig {
  readonly driver: typeof ANGULAR_DRIVER
  /** A test's fixture. Every action ends at its `whenStable()`. */
  readonly fixture: AngularFixture | undefined
  /** A bootstrapped app. Without a fixture, every action ends at its `whenStable()`. */
  readonly app: ApplicationRef | undefined
  /**
   * Where queries start, scoped and `{ global: true }` alike. Defaults to
   * `document.body`, read at query time: TestBed attaches each fixture there,
   * and the CDK's overlays and other portals render there too.
   */
  readonly root: Element | undefined
}

export interface AngularEnvOptions {
  /** A `ComponentFixture`: TestBed's `createComponent()`, or a render result's `fixture`. */
  fixture?: AngularFixture
  /** The `ApplicationRef` `bootstrapApplication()` resolves to, for an app with no fixture. */
  app?: ApplicationRef
  root?: Element
}

/**
 * Builds the env a harness is constructed with in an Angular test:
 *
 * ```ts
 * const { fixture } = await render(LoginForm)
 * const form = new LoginFormHarness(angular({ fixture }))
 * ```
 *
 * or, for an app bootstrapped without TestBed:
 *
 * ```ts
 * const app = await bootstrapApplication(App, appConfig)
 * const page = new CheckoutPage(angular({ app }))
 * ```
 *
 * One of the two is required. Nothing else finds an app reliably: the `ng`
 * global and `getAllAngularRootElements()` exist only in development builds,
 * and testabilities only where zone.js is loaded.
 */
export function angular({ fixture, app, root }: AngularEnvOptions = {}): AngularEnv {
  if (fixture === undefined && app === undefined) {
    throw new TypeError(
      'harnessed: angular() needs the app it drives — pass { fixture } from TestBed or a ' +
        'render result, or { app } with the ApplicationRef bootstrapApplication() resolved to.',
    )
  }
  return { driver: ANGULAR_DRIVER, fixture, app, root }
}
