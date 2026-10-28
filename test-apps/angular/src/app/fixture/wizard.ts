import { Component, computed, input, output } from '@angular/core'

@Component({
  selector: 'section[fixtureStepOne]',
  host: { 'data-testid': 'page-step-one' },
  template: `
    <h1>Step one</h1>
    <button type="button" (click)="next.emit()">Continue</button>
  `,
})
export class StepOne {
  readonly next = output()
}

@Component({
  selector: 'section[fixtureStepTwo]',
  host: { 'data-testid': 'page-step-two' },
  template: `
    <h1>Step two</h1>
    @if (expired()) {
      <p data-testid="step-two-expired">That link has expired</p>
    } @else {
      <p data-testid="step-two-token">{{ token() }}</p>
    }
  `,
})
export class StepTwo {
  readonly token = input<string | null>(null)
  protected readonly expired = computed(() => this.token() === null || this.token() === 'expired')
}
