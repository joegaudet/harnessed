import { Show } from 'solid-js'

export function StepOne(props: { onNext: () => void }) {
  return (
    <section data-testid="page-step-one">
      <h1>Step one</h1>
      <button type="button" onClick={() => props.onNext()}>
        Continue
      </button>
    </section>
  )
}

export function StepTwo(props: { token: string | null }) {
  const expired = () => props.token === null || props.token === 'expired'
  return (
    <section data-testid="page-step-two">
      <h1>Step two</h1>
      <Show
        when={!expired()}
        fallback={<p data-testid="step-two-expired">That link has expired</p>}
      >
        <p data-testid="step-two-token">{props.token}</p>
      </Show>
    </section>
  )
}
