/**
 * A framework-neutral description of what a fixture view renders: elements,
 * the attributes harnesses select and assert on, and their visible text. Two
 * fixtures — the React original and a port to another framework — render the
 * same view when their trees are equal. That is the guard that keeps a port
 * from drifting: "every driver agrees" only means something if every driver is
 * looking at the same markup.
 *
 * Deliberately blind to how a framework builds the DOM: comments, whitespace
 * between elements, attribute order, and `style` are not part of the contract.
 */
export interface FixtureNode {
  tag: string
  attrs: Record<string, string | boolean>
  text: string
  children: FixtureNode[]
}

const ATTRIBUTES = [
  'data-testid',
  'role',
  'id',
  'for',
  'type',
  'placeholder',
  'title',
  'data-status',
]

function attributesOf(element: Element): Record<string, string | boolean> {
  const attrs: Record<string, string | boolean> = {}
  for (const name of ATTRIBUTES) {
    const value = element.getAttribute(name)
    if (value !== null) attrs[name] = value
  }
  for (const { name, value } of [...element.attributes]) {
    if (name.startsWith('aria-')) attrs[name] = value
  }
  // Properties, not attributes: a framework may set either, and a harness reads
  // the live state.
  if ('disabled' in element && (element as HTMLInputElement).disabled) attrs.disabled = true
  if ('multiple' in element && (element as HTMLSelectElement).multiple) attrs.multiple = true
  if (element.localName === 'option' && (element as HTMLOptionElement).selected) {
    attrs.selected = true
  }
  if (element.localName === 'option') attrs.value = (element as HTMLOptionElement).value
  return attrs
}

/** The tree under `root`, entering same-origin frames as their body's children. */
export function fixtureTree(root: Element): FixtureNode {
  const text = [...root.childNodes]
    .filter(node => node.nodeType === 3)
    .map(node => node.textContent ?? '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  const children = [...root.children].map(fixtureTree)
  if (root.localName === 'iframe') {
    const body = (root as HTMLIFrameElement).contentDocument?.body
    if (body != null) children.push(...[...body.children].map(fixtureTree))
  }
  return { tag: root.localName, attrs: attributesOf(root), text, children }
}
