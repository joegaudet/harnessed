/**
 * A framework-neutral description of what a fixture view renders: elements,
 * the attributes harnesses select and assert on or that change a node's role,
 * name or focusability, and their text in document order. Two fixtures — the
 * React original and a port to another framework — render the same view when
 * their trees are equal. That is the guard that keeps a port from drifting:
 * "every driver agrees" only means something if every driver is looking at the
 * same markup.
 *
 * Deliberately blind to how a framework builds the DOM: comments, whitespace
 * between elements, how text is split into nodes, attribute order, `class` and
 * `style` are not part of the contract. It compares a view as first rendered;
 * behaviour after an interaction is what the catalog itself checks.
 */
export interface FixtureNode {
  tag: string
  attrs: Record<string, string | boolean>
  /** Elements and text, in document order. Text is whitespace-collapsed. */
  children: Array<FixtureNode | string>
}

const ATTRIBUTES = [
  'data-testid',
  'data-status',
  'role',
  'id',
  'for',
  'type',
  'name',
  'placeholder',
  'title',
  'href',
  'alt',
  'tabindex',
  'contenteditable',
]

/** Live state a framework may set as a property or an attribute. */
const STATES = ['disabled', 'multiple', 'checked', 'readOnly', 'hidden', 'open'] as const

function attributesOf(element: Element): Record<string, string | boolean> {
  const attrs: Record<string, string | boolean> = {}
  for (const name of ATTRIBUTES) {
    const value = element.getAttribute(name)
    if (value !== null) attrs[name] = value
  }
  for (const { name, value } of [...element.attributes]) {
    if (name.startsWith('aria-')) attrs[name] = value
  }
  for (const state of STATES) {
    if (state in element && (element as unknown as Record<string, unknown>)[state] === true) {
      attrs[state] = true
    }
  }
  if (element.localName === 'option') {
    attrs.value = (element as HTMLOptionElement).value
    if ((element as HTMLOptionElement).selected) attrs.selected = true
  }
  // A button's value is part of what a form submits; an input's typed value is
  // state, not markup, and starts empty in both fixtures anyway.
  if (element.localName === 'button' && element.hasAttribute('value')) {
    attrs.value = element.getAttribute('value') ?? ''
  }
  return attrs
}

function childrenOf(root: Element): Array<FixtureNode | string> {
  const children: Array<FixtureNode | string> = []
  let text = ''
  const flush = (): void => {
    const collapsed = text.replace(/\s+/g, ' ').trim()
    if (collapsed !== '') children.push(collapsed)
    text = ''
  }
  for (const node of root.childNodes) {
    // Adjacent text nodes are one run, however the framework split them.
    if (node.nodeType === 3) text += node.textContent ?? ''
    else if (node.nodeType === 1) {
      flush()
      children.push(fixtureTree(node as Element))
    }
  }
  flush()
  return children
}

/** The tree under `root`, entering same-origin frames as their body's children. */
export function fixtureTree(root: Element): FixtureNode {
  const children = childrenOf(root)
  if (root.localName === 'iframe') {
    const body = (root as HTMLIFrameElement).contentDocument?.body
    if (body != null) children.push(...childrenOf(body))
  }
  return { tag: root.localName, attrs: attributesOf(root), children }
}
