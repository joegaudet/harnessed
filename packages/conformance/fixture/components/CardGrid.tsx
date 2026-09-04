import { useState } from 'react'

export interface CardSpec {
  label: string
  hint?: string
}

export interface CardProps extends CardSpec {
  on: boolean
  onChoose: () => void
}

/** The host IS the interactive element — exercises `self`. Selection is aria-pressed. */
export function Card({ label, hint, on, onChoose }: CardProps) {
  return (
    <button type="button" data-testid="card" aria-pressed={on} onClick={onChoose}>
      <span data-testid="card-label">{label}</span>
      {hint ? <small data-testid="card-hint">{hint}</small> : null}
    </button>
  )
}

/** Several instances of one component on one screen — exercises count/nth/map/filter. */
export function CardGrid({ cards }: { cards: CardSpec[] }) {
  const [chosen, setChosen] = useState<string | null>(null)
  return (
    <div data-testid="card-grid">
      <h1>Options</h1>
      <h2>Pick one</h2>
      {cards.map(c => (
        <Card key={c.label} {...c} on={chosen === c.label} onChoose={() => setChosen(c.label)} />
      ))}
    </div>
  )
}
