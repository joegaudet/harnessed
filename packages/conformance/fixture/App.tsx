import { useState } from 'react'
import { CardGrid } from './components/CardGrid'
import { LoginForm } from './components/LoginForm'
import { PortalDialog } from './components/PortalDialog'
import { StepOne, StepTwo } from './components/Wizard'

export const CARDS = [
  { label: 'Small', hint: 'Under 1000 sq ft' },
  { label: 'Medium', hint: '1000 to 2500 sq ft' },
  { label: 'Large' },
]

/**
 * The Playwright side of the conformance suite drives the real app; `?view=` picks
 * which component is under test and the pathname picks the wizard step. Everything
 * renders inside one `stage` element, so route harnesses share a host selector.
 */
export function App() {
  const url = new URL(window.location.href)
  const view = url.searchParams.get('view') ?? 'wizard'
  const [step, setStep] = useState<'one' | 'two'>('one')

  return (
    <div data-testid="stage">
      {view === 'login' ? (
        <LoginForm
          error={url.searchParams.get('error') ?? undefined}
          lateDuplicates={url.searchParams.get('late') === '1'}
        />
      ) : null}
      {view === 'cards' ? (
        <>
          <CardGrid cards={CARDS} />
          {/* Same test id, outside the grid: a scope-dropping query finds this. */}
          <span data-testid="card-hint">decoy outside the grid</span>
        </>
      ) : null}
      {view === 'dialog' ? <PortalDialog /> : null}
      {view === 'wizard' ? (
        url.pathname === '/step-two' ? (
          <StepTwo token={url.searchParams.get('token')} />
        ) : step === 'two' ? (
          <StepTwo token="in-page" />
        ) : (
          <StepOne onNext={() => setStep('two')} />
        )
      ) : null}
    </div>
  )
}
