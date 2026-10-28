export interface CardSpec {
  label: string
  hint?: string
}

export const CARDS: CardSpec[] = [
  { label: 'Small', hint: 'Under 1000 sq ft' },
  { label: 'Medium', hint: '1000 to 2500 sq ft' },
  { label: 'Large' },
]
