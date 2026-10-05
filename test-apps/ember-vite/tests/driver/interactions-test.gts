import { module, test } from 'qunit'
import { setupRenderingTest } from 'ember-qunit'
import { render } from '@ember/test-helpers'
import { createQuery, testId } from '@harnessed-ts/core'
import type { Query } from '@harnessed-ts/core'
import { ember } from '@harnessed-ts/ember'

/**
 * What the catalog's single hover/focus/press spec cannot see: keys pressed the
 * way a browser would handle them, hover leaving one element for another,
 * options picked by label, and focus on elements test-helpers will not focus.
 * Each case is what the dom and Playwright drivers already do.
 */
function target(id: string): Query {
  return createQuery(ember(), [], testId(id))
}

/** Not `input`: in a strict-mode template that name would shadow `<input>`. */
function field(id: string): HTMLInputElement {
  return document.querySelector(`[data-testid="${id}"]`) as HTMLInputElement
}

function recordKeys(log: string[]) {
  return (event: KeyboardEvent) => log.push(event.key)
}

module('Ember driver | interactions', function (hooks) {
  setupRenderingTest(hooks)

  test('press dispatches the key as given, on any element', async function (assert) {
    const keys: string[] = []
    const record = recordKeys(keys)
    await render(
      <template>
        <button type="button" data-testid="b" {{on "keydown" record}}>B</button>
      </template>,
    )
    await target('b').press('j')
    await target('b').press('Escape')
    assert.deepEqual(keys, ['j', 'Escape'])
  })

  test('press on an element that cannot take focus goes where a browser sends it', async function (assert) {
    // As under the dom and Playwright drivers: the element cannot be focused,
    // so the key goes to whatever has focus — not a refusal, as test-helpers'
    // focus() would make it.
    const keys: string[] = []
    const record = recordKeys(keys)
    document.addEventListener('keydown', record)
    try {
      await render(<template><div role="dialog" data-testid="d">Dialog</div></template>)
      await target('d').press('Escape')
    } finally {
      document.removeEventListener('keydown', record)
    }
    assert.deepEqual(keys, ['Escape'])
  })

  test('focus and blur do not throw on an element that is not focusable', async function (assert) {
    await render(<template><p data-testid="p">text</p></template>)
    await target('p').focus()
    await target('p').blur()
    assert.ok(true)
  })

  test('Backspace deletes before the caret, and nothing at position 0', async function (assert) {
    await render(<template><input data-testid="t" value="abc" /></template>)
    field('t').focus()
    field('t').setSelectionRange(1, 1)
    await target('t').press('Backspace')
    assert.strictEqual(field('t').value, 'bc')
    field('t').setSelectionRange(0, 0)
    await target('t').press('Backspace')
    assert.strictEqual(field('t').value, 'bc')
  })

  test('a printable key is inserted at the caret', async function (assert) {
    await render(<template><input data-testid="t" value="abc" /></template>)
    field('t').focus()
    field('t').setSelectionRange(1, 1)
    await target('t').press('x')
    assert.strictEqual(field('t').value, 'axbc')
  })

  test('Backspace works in an email input, which has no selection API', async function (assert) {
    // Typed first, as the catalog's own frame spec does: where a bare focus()
    // leaves the caret is not something browsers agree on.
    await render(<template><input type="email" data-testid="e" /></template>)
    await target('e').fill('a@b')
    await target('e').press('Backspace')
    assert.strictEqual(field('e').value, 'a@')
  })

  test('a key past maxlength is dropped, not thrown', async function (assert) {
    await render(<template><input data-testid="m" maxlength="2" value="ab" /></template>)
    await target('m').press('c')
    assert.strictEqual(field('m').value, 'ab')
  })

  test('hovering one element and then another leaves the first', async function (assert) {
    const events: string[] = []
    const leftA = () => events.push('leave a')
    const enteredB = () => events.push('enter b')
    await render(
      <template>
        <span data-testid="a" {{on "mouseleave" leftA}}>A</span>
        <span data-testid="b" {{on "mouseenter" enteredB}}>B</span>
      </template>,
    )
    await target('a').hover()
    await target('b').hover()
    assert.deepEqual(events, ['leave a', 'enter b'])
  })

  test('selectOption matches a label as well as a value, and refuses a miss', async function (assert) {
    await render(
      <template>
        <select data-testid="s">
          <option value="free">Free</option>
          <option value="pro">Pro</option>
        </select>
      </template>,
    )
    await target('s').selectOption('Pro')
    assert.strictEqual(field('s').value, 'pro')
    await assert.rejects(target('s').selectOption('nope'))
    assert.strictEqual(field('s').value, 'pro', 'a miss leaves the selection alone')
  })
})

import { on } from '@ember/modifier'
