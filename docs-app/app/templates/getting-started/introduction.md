# Introduction

Test harnesses for components and pages: like page objects, but for components
too. One API that runs under every major JavaScript test runner: Testing Library,
Playwright, Ember, Cypress, WebdriverIO, Vitest browser mode, Puppeteer,
TestCafe, Nightwatch, node:test and Bun, with Gherkin on top, and inside Storybook's play functions.

A **harness** is a class that lets a test drive a component the way a person would,
through methods named for what the component _does_. Tests state intent; the
harness owns the DOM wiring. Write the harness once and it works in a fast jsdom
unit test and in a real browser.

```ts
@Harness({ host: testId('login-form') })
class LoginFormHarness extends ComponentHarness {
  @ByLabel('Email') private accessor email!: Query
  @ByLabel('Password') private accessor password!: Query
  @ByRole('button', { name: /sign in/i }) private accessor submit!: Query
  @ByTestId('login-error') private accessor errorLine!: Query

  async signInAs(email: string, password: string): Promise<void> {
    await this.email.fill(email)
    await this.password.fill(password)
    await this.submit.click()
  }

  async error(): Promise<string | null> {
    if (await this.errorLine.isAbsent()) return null
    return this.errorLine.text()
  }
}
```

```ts
// jsdom, via Testing Library
render(<LoginForm />)
const form = new LoginFormHarness(dom({ user: userEvent.setup() }))
await form.signInAs('ada@example.com', 'hunter2')
expect(await form.error()).toBeNull()

// a real browser, via Playwright — the same harness class
const form = new LoginFormHarness(pw(page))
await form.signInAs('ada@example.com', 'hunter2')
await expect(form).toBeAbsent()
```

## Why

- Tests stop knowing about DOM structure, CSS classes, and internal state.
- Tests read as a list of things the component can do.
- One harness serves every level of the pyramid — no second set of selectors for
  the browser suite that drifts out of step with the first.

Inspired by [Angular CDK Component Harnesses][cdk],
[ember-test-fixture][etf], and [Playwright Page Object Models][pom].

[cdk]: https://angular.dev/guide/testing/component-harnesses-overview
[etf]: https://github.com/jayseo5953/ember-test-fixture
[pom]: https://playwright.dev/docs/pom

## Where next

- [Installation](installation.md): the packages, and the one-time setup each runner needs.
- [Selectors](../writing-harnesses/selectors.md) and [Queries](../writing-harnesses/queries.md): how a harness finds and drives its parts.
- [Runners](../runners/testing-library.md): one page per runner, from jsdom to a real browser.
