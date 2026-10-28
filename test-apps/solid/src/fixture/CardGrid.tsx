import { createMemo, createSignal, For, Show } from 'solid-js'

export interface CardSpec {
  label: string
  hint?: string
}

export interface CardProps extends CardSpec {
  on: boolean
  onChoose: () => void
}

/** The host IS the interactive element — exercises `self`. Selection is aria-pressed. */
export function Card(props: CardProps) {
  return (
    <button
      type="button"
      data-testid="card"
      data-test-card=""
      aria-pressed={props.on}
      onClick={() => props.onChoose()}
    >
      {/* A presence attribute may carry a value; it still matches by name alone. */}
      <span data-testid="card-label" data-test-card-label={props.label}>
        {props.label}
      </span>
      <Show when={props.hint}>
        <small data-testid="card-hint" data-test-card-hint="">
          {props.hint}
        </small>
      </Show>
    </button>
  )
}

interface Entry extends CardSpec {
  on: boolean
}

/** Several instances of one component on one screen — exercises count/nth/map/filter. */
export function CardGrid(props: { cards: CardSpec[] }) {
  const [chosen, setChosen] = createSignal<string | null>(null)

  // React keys each card by `label:selected`, so choosing REPLACES the DOM node
  // rather than mutating it — deliberately, because a resolved-once list that
  // keeps reading a detached node reads stale values silently. <For> keys by
  // item identity, so each `label:selected` pair keeps one entry object: the
  // cards whose key changed get new nodes, the rest keep theirs.
  let entries = new Map<string, Entry>()
  const list = createMemo(() => {
    const next = new Map<string, Entry>()
    const items = props.cards.map(card => {
      const on = chosen() === card.label
      const key = `${card.label}:${on}`
      const entry = entries.get(key) ?? { ...card, on }
      next.set(key, entry)
      return entry
    })
    entries = next
    return items
  })

  return (
    <div data-testid="card-grid" data-test-card-grid="">
      <h1>Options</h1>
      <h2>Pick one</h2>
      <For each={list()}>
        {entry => (
          <Card
            label={entry.label}
            hint={entry.hint}
            on={entry.on}
            onChoose={() => setChosen(entry.label)}
          />
        )}
      </For>
    </div>
  )
}
