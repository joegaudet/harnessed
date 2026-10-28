import { createSignal, Show } from 'solid-js'
import { CardGrid } from './CardGrid'
import type { CardSpec } from './CardGrid'
import { DataScreen } from './DataScreen'
import { FramedPanel } from './FramedPanel'
import { LoginForm } from './LoginForm'
import { PortalDialog } from './PortalDialog'
import { StepOne, StepTwo } from './Wizard'

export const CARDS: CardSpec[] = [
  { label: 'Small', hint: 'Under 1000 sq ft' },
  { label: 'Medium', hint: '1000 to 2500 sq ft' },
  { label: 'Large' },
]

/**
 * The Solid port of the conformance fixture's App: `?view=` picks the component
 * under test and the pathname picks the wizard step, read once when the
 * component runs, as the React original reads them at render. It must render
 * the same tree as the React original — the fixture-parity test holds it to that.
 */
export function ConformanceApp() {
  const url = new URL(window.location.href)
  const view = url.searchParams.get('view') ?? 'wizard'
  const [step, setStep] = createSignal<'one' | 'two'>('one')

  return (
    <div data-testid="stage">
      <Show when={view === 'login'}>
        <section data-testid="page-login">
          <LoginForm
            error={url.searchParams.get('error') ?? undefined}
            lateDuplicates={url.searchParams.get('late') === '1'}
          />
        </section>
      </Show>
      <Show when={view === 'cards'}>
        <section data-testid="page-cards">
          <CardGrid cards={CARDS} />
          {/* Same test id, outside the grid: a scope-dropping query finds this. */}
          <span data-testid="card-hint" data-test-card-hint="">
            decoy outside the grid
          </span>
        </section>
      </Show>
      <Show when={view === 'dialog'}>
        <section data-testid="page-dialog">
          <PortalDialog />
        </section>
      </Show>
      <Show when={view === 'frame'}>
        <section data-testid="page-frame">
          <FramedPanel />
        </section>
      </Show>
      <Show when={view === 'data'}>
        <section data-testid="page-data">
          <DataScreen />
        </section>
      </Show>
      <Show when={view === 'wizard'}>
        <section data-testid="page-wizard">
          <Show
            when={url.pathname !== '/step-two'}
            fallback={<StepTwo token={url.searchParams.get('token')} />}
          >
            <Show when={step() === 'two'} fallback={<StepOne onNext={() => setStep('two')} />}>
              <StepTwo token="in-page" />
            </Show>
          </Show>
        </section>
      </Show>
    </div>
  )
}
