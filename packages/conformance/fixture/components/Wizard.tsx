export function StepOne({ onNext }: { onNext: () => void }) {
  return (
    <section data-testid="screen-step-one">
      <h1>Step one</h1>
      <button type="button" onClick={onNext}>
        Continue
      </button>
    </section>
  )
}

export function StepTwo({ token }: { token: string | null }) {
  const expired = token === null || token === 'expired'
  return (
    <section data-testid="screen-step-two">
      <h1>Step two</h1>
      {expired ? (
        <p data-testid="step-two-expired">That link has expired</p>
      ) : (
        <p data-testid="step-two-token">{token}</p>
      )}
    </section>
  )
}
