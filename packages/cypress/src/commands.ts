import { getConfig } from '@harnessed-ts/core'
import type { EnvConfig, WaitOptions } from '@harnessed-ts/core'
import { cypress } from './env'
import type { CypressEnv } from './env'

/** What every bridge command accepts. */
export interface HarnessCommandOptions {
  /**
   * How long the whole callback may take. Defaults to four times the configured
   * `defaultTimeout`: one harness flow is several waits in a row, and Cypress's own
   * 4 s command timeout would otherwise cut it short.
   */
  timeout?: number
  /** Trusted CDP input instead of user-event. Chromium only. */
  realEvents?: boolean
  /** Write each harness action to the command log. Default `true`. */
  log?: boolean
}

/** Any harness or page class: constructed from an env, like every harness. */
export type HarnessClass<H> = new (env: EnvConfig) => H

/** What `cy.visitPage` needs of a page — structural, so this package does not depend on `@harnessed-ts/page`. */
export interface VisitablePage {
  // Method syntax on purpose: a page's `urlFor` takes its own params tuple, and
  // only a method signature accepts every one of them.
  urlFor(...args: unknown[]): string
  expectReady(options?: WaitOptions): Promise<void>
}

/** The params `PageClass.urlFor` takes, then the command's options. */
export type VisitPageArgs<P extends VisitablePage> = [
  ...Parameters<P['urlFor']>,
  options?: HarnessCommandOptions,
]

/** What a callback command yields: its result, or the subject when it resolves nothing. */
export type Yielded<T, Subject> = T extends void | undefined ? Subject : T

declare global {
  // Cypress's augmentation point is this global namespace.
  namespace Cypress {
    // The type parameter is Cypress's, default and all; a merged declaration only
    // has to repeat its name.
    interface Chainable<Subject> {
      /**
       * Runs `fn` against the application under test with a harnessed env, and
       * yields what it resolves to — or, like `cy.then`, passes the subject
       * through when it resolves nothing. One command: everything inside is
       * awaited promises, never `cy` commands.
       */
      harnessEnv<T>(
        fn: (env: CypressEnv) => T | PromiseLike<T>,
        options?: HarnessCommandOptions,
      ): Chainable<Yielded<T, Subject>>
      /** Yields a harness constructed against the application under test. */
      harness<H>(Harness: HarnessClass<H>, options?: HarnessCommandOptions): Chainable<H>
      /**
       * Constructs a harness against the application under test and awaits `fn`
       * with it, yielding what `fn` resolves to (or passing the subject through,
       * when that is nothing):
       *
       * ```ts
       * cy.harness(LoginFormHarness, async form => {
       *   await form.fillIn({ email: 'ada@example.com' })
       *   await expect(form).not.to.be.absent
       * })
       * ```
       */
      harness<H, T>(
        Harness: HarnessClass<H>,
        fn: (harness: H) => T | PromiseLike<T>,
        options?: HarnessCommandOptions,
      ): Chainable<Yielded<T, Subject>>
      /**
       * `cy.visit(page.urlFor(params))`, then waits for the page's `expectReady()`
       * and yields the page. Navigation belongs to Cypress's queue, which is why
       * this is a command and `page.goto()` is not the way in.
       */
      visitPage<P extends VisitablePage>(
        Page: HarnessClass<P>,
        ...args: VisitPageArgs<P>
      ): Chainable<P>
    }
  }
}

function timeoutOf(options?: HarnessCommandOptions): number {
  return options?.timeout ?? getConfig().defaultTimeout * 4
}

function envFor(window: Window, options?: HarnessCommandOptions): CypressEnv {
  return cypress({
    window,
    realEvents: options?.realEvents ?? false,
    log: options?.log ?? true,
  })
}

/**
 * The bridge. Cypress commands are enqueued, not awaited, and a promise cannot
 * enqueue one — so a harness runs entirely inside a single `then`, as plain
 * promises against the AUT document. Cypress waits for the promise and fails the
 * test with whatever it rejects with.
 *
 * What it yields is `Yielded`: the result, or the subject when the result is
 * `undefined`. A `then` cannot yield `undefined` — it passes its own subject,
 * the AUT window, through instead — so the result travels boxed, and `cy.wrap`
 * yields it as is, `undefined` included.
 */
function inPage<T>(
  subject: unknown,
  fn: (env: CypressEnv) => T | PromiseLike<T>,
  options?: HarnessCommandOptions,
): Cypress.Chainable<unknown> {
  return cy
    .window({ log: false })
    .then({ timeout: timeoutOf(options) }, async window => ({
      result: await fn(envFor(window, options)),
    }))
    .then(({ result }) => cy.wrap(result === undefined ? subject : result, { log: false }))
}

/**
 * Registers `cy.harnessEnv`, `cy.harness` and `cy.visitPage`. Importing
 * `@harnessed-ts/cypress/support` calls this; call it yourself only if you
 * register commands from your own support file instead.
 */
export function registerCommands(): void {
  // 'optional': chained from anything or from nothing. The subject is only ever
  // passed through, never acted on.
  Cypress.Commands.add(
    'harnessEnv',
    { prevSubject: 'optional' },
    <T>(
      subject: unknown,
      fn: (env: CypressEnv) => T | PromiseLike<T>,
      options?: HarnessCommandOptions,
    ) => inPage(subject, fn, options),
  )

  Cypress.Commands.add(
    'harness',
    { prevSubject: 'optional' },
    <H, T>(
      subject: unknown,
      Harness: HarnessClass<H>,
      fnOrOptions?: ((harness: H) => T | PromiseLike<T>) | HarnessCommandOptions,
      maybeOptions?: HarnessCommandOptions,
    ) => {
      const fn = typeof fnOrOptions === 'function' ? fnOrOptions : undefined
      const options = typeof fnOrOptions === 'function' ? maybeOptions : fnOrOptions
      Cypress.log({ name: 'harness', message: Harness.name })
      return inPage(
        subject,
        env => {
          const harness = new Harness(env)
          return fn === undefined ? harness : fn(harness)
        },
        options,
      )
    },
  )

  Cypress.Commands.add(
    'visitPage',
    (Page: HarnessClass<VisitablePage>, params?: unknown, rawOptions?: unknown) => {
      // Cypress erases the generic signature here; the declaration above is what
      // callers are checked against.
      const options = rawOptions as HarnessCommandOptions | undefined
      return cy.window({ log: false }).then(window => {
        // urlFor needs no navigation, so the page can be built before the visit;
        // the AUT window it holds is the same object after it.
        const page = new Page(envFor(window, options))
        return cy.visit(page.urlFor(params)).then({ timeout: timeoutOf(options) }, async () => {
          await page.expectReady()
          return page
        })
      })
    },
  )
}
