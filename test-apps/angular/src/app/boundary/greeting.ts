import { Component, Input, signal } from '@angular/core'

/** Read by the harness beside this file, which imports this module to get it. */
export const GREETING_TEST_ID = 'greeting'

/**
 * One side of the decorator boundary: an app component, compiled by the Angular
 * plugin with the app's legacy `experimentalDecorators` — `@Input()` included —
 * though a harness and a page using standard decorators sit beside it. The
 * harnessed plugin must leave this file alone, and the Angular plugin must
 * leave those two alone.
 */
@Component({
  selector: 'section[appGreeting]',
  host: { '[attr.data-testid]': 'testId' },
  template: `
    <h2>Hello, {{ name }}</h2>
    <button type="button" (click)="wave()">Wave</button>
    <p data-testid="greeting-waves">{{ waves() }}</p>
  `,
})
export class Greeting {
  @Input({ required: true }) name = ''

  protected readonly testId = GREETING_TEST_ID
  protected readonly waves = signal(0)

  protected wave(): void {
    this.waves.update(waves => waves + 1)
  }
}
