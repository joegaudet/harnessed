import { inputBinding } from '@angular/core'
import { angular } from '@harnessed-ts/angular'
import { render } from '@testing-library/angular/zoneless'
import { describe, expect, it } from 'vitest'
import { Greeting } from '../src/app/boundary/greeting'
import { GreetingHarness } from '../src/app/boundary/greeting.harness'
import { GreetingPage } from '../src/app/boundary/greeting.page'

/**
 * The shared conformance harnesses arrive prebuilt, so the catalog never
 * crosses the decorator boundary. An app's own harnesses do, every time: these
 * live beside the component they drive, and each plugin must claim only its
 * own files.
 */
describe('decorator boundary', () => {
  it('a component beside a harness compiles with the app’s decorators, @Input() included', async () => {
    const { fixture } = await render(Greeting, {
      bindings: [inputBinding('name', () => 'Ada')],
      waitForStableOnRender: true,
    })
    const greeting = new GreetingHarness(angular({ fixture }))
    expect(await greeting.heading()).toBe('Hello, Ada')
  })

  it('a harness importing the component’s module keeps its accessor fields', async () => {
    const { fixture } = await render(Greeting, {
      bindings: [inputBinding('name', () => 'Ada')],
      waitForStableOnRender: true,
    })
    const greeting = new GreetingHarness(angular({ fixture }))
    await greeting.wave()
    await greeting.wave()
    expect(await greeting.waves()).toBe(2)
  })

  it('a page file beside them is lowered the same way', async () => {
    const { fixture } = await render(
      `<div data-testid="greeting-page"><section appGreeting name="Grace"></section></div>`,
      { imports: [Greeting], waitForStableOnRender: true },
    )
    const page = new GreetingPage(angular({ fixture }))
    await page.expectReady()
    expect(await page.greeting.heading()).toBe('Hello, Grace')
  })
})
