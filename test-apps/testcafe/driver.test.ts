import assert from 'node:assert/strict'
import { viewSearch } from '@harnessed-ts/conformance'
import { createQuery, navigationFor, role, testId } from '@harnessed-ts/core'
import { testcafe } from '@harnessed-ts/testcafe'
import { ClientFunction, t as sharedController } from 'testcafe'

/** The React fixture `pnpm serve:fixture` serves; see conformance.test.ts. */
const FIXTURE = 'http://127.0.0.1:5184'

fixture('testcafe driver').page(`${FIXTURE}/`)

/** Replaces the page's content, as Puppeteer's `setContent` would. */
const setContent = ClientFunction((html: string) => {
  document.body.innerHTML = html
})

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * What this driver promises beyond the shared catalog: the edges of its own
 * adapters — key names, the select and fill emulation, the URL it caches, and
 * how TestCafe's failures read.
 */

test('presses a chord with its modifiers held', async t => {
  await setContent(
    `<input aria-label="Keys" onkeydown="if (!['Shift', 'Control'].includes(event.key)) this.dataset.last = event.ctrlKey + ':' + event.shiftKey + ':' + event.key">`,
  )
  const keys = createQuery(testcafe(t), [], role('textbox', { name: 'Keys' }))
  await keys.press('Shift+ArrowLeft')
  assert.equal(await keys.attribute('data-last'), 'false:true:ArrowLeft')
  await keys.press('Control+KeyA')
  assert.equal(await keys.attribute('data-last'), 'true:false:a')
})

test('reads a lone + as the plus key, and Control++ as Control held over it', async t => {
  await setContent(
    `<input aria-label="Keys" onkeydown="if (!['Shift', 'Control'].includes(event.key)) this.dataset.last = event.ctrlKey + ':' + event.key">`,
  )
  const keys = createQuery(testcafe(t), [], role('textbox', { name: 'Keys' }))
  await keys.press('+')
  assert.equal(await keys.attribute('data-last'), 'false:+')
  await keys.press('Control++')
  assert.equal(await keys.attribute('data-last'), 'true:+')
})

test("reads ControlOrMeta from the browser's platform, not the runner's", async t => {
  await setContent(
    `<input aria-label="Keys" onkeydown="if (!['Meta', 'Control'].includes(event.key)) this.dataset.last = event.ctrlKey + ':' + event.metaKey + ':' + event.key">`,
  )
  await ClientFunction(() => {
    Object.defineProperty(navigator, 'platform', { get: () => 'Linux x86_64' })
  })()
  const keys = createQuery(testcafe(t), [], role('textbox', { name: 'Keys' }))
  await keys.press('ControlOrMeta+KeyA')
  assert.equal(await keys.attribute('data-last'), 'true:false:a')
})

test('refuses a key TestCafe cannot press, and presses nothing', async t => {
  await setContent(
    `<input aria-label="Keys" onkeydown="this.dataset.pressed = (this.dataset.pressed || '') + event.key">`,
  )
  const keys = createQuery(testcafe(t), [], role('textbox', { name: 'Keys' }))
  await assert.rejects(
    keys.press('Control+F5'),
    /press\(\) cannot send "Control\+F5" under TestCafe/,
  )
  assert.equal(await keys.attribute('data-pressed'), null)
})

test('selects an option by its label as well as its value', async t => {
  await setContent(
    `<select aria-label="Plan"><option value="free">Free</option><option value="pro">Pro plan</option></select>`,
  )
  const plan = createQuery(testcafe(t), [], role('combobox', { name: 'Plan' }))
  await plan.selectOption('Pro plan')
  assert.deepEqual(await plan.selectedOptions(), ['pro'])
})

test("replaces a multi-select's selection rather than adding to it", async t => {
  await setContent(
    `<select aria-label="Tags" multiple><option value="a" selected>A</option><option value="b" selected>B</option><option value="c">C</option></select>`,
  )
  const tags = createQuery(testcafe(t), [], role('listbox', { name: 'Tags' }))
  await tags.selectOption(['c'])
  assert.deepEqual(await tags.selectedOptions(), ['c'])
})

test('refuses several values for a single-select, naming it', async t => {
  await setContent(
    `<select data-testid="plan"><option value="free">Free</option><option value="pro">Pro</option></select>`,
  )
  const plan = createQuery(testcafe(t), [], testId('plan'))
  await assert.rejects(plan.selectOption(['free', 'pro']), /several values.*testId\(plan\)/)
  assert.deepEqual(await plan.selectedOptions(), ['free'])
})

test('names the target when no option matches', async t => {
  await setContent(`<select data-testid="plan"><option value="free">Free</option></select>`)
  const plan = createQuery(testcafe(t), [], testId('plan'))
  await assert.rejects(plan.selectOption('gold'), /no <option> of testId\(plan\) matches "gold"/)
})

test('refuses to fill an element that takes no text, naming it', async t => {
  await setContent(`<p data-testid="para">text</p>`)
  const para = createQuery(testcafe(t), [], testId('para'))
  await assert.rejects(para.fill('x'), /fill\(\) needs an <input>.*testId\(para\) is a <p>/)
})

test('refuses to fill a wrapper rather than typing into what it contains', async t => {
  await setContent(`<div data-testid="wrap"><input aria-label="Inner"></div>`)
  const wrap = createQuery(testcafe(t), [], testId('wrap'))
  const inner = createQuery(testcafe(t), [], role('textbox', { name: 'Inner' }))
  await assert.rejects(wrap.fill('typed'), /fill\(\) needs an <input>.*testId\(wrap\) is a <div>/)
  assert.equal(await inner.inputValue(), '')
})

test('refuses to fill an input that takes no text, as Playwright does', async t => {
  await setContent(
    `<input type="checkbox" aria-label="Agree"><input type="radio" aria-label="One">`,
  )
  const agree = createQuery(testcafe(t), [], role('checkbox', { name: 'Agree' }))
  const one = createQuery(testcafe(t), [], role('radio', { name: 'One' }))
  await assert.rejects(agree.fill('x'), /fill\(\) needs an <input>.*is a <input type="checkbox">/)
  await assert.rejects(one.clear(), /clear\(\) needs an <input>.*is a <input type="radio">/)
})

test('refuses to fill an aria-disabled input', async t => {
  await setContent(`<input aria-label="Name" aria-disabled="true">`)
  const name = createQuery(testcafe(t), [], role('textbox', { name: 'Name' }))
  await assert.rejects(name.fill('typed', { timeout: 300 }), /fill\(\) could not edit .*disabled/)
  assert.equal(await name.inputValue(), '')
})

test('refuses to fill a disabled input, even through its fieldset', async t => {
  await setContent(
    `<input aria-label="Name" disabled><fieldset disabled><input aria-label="Code"></fieldset>`,
  )
  const name = createQuery(testcafe(t), [], role('textbox', { name: 'Name' }))
  const code = createQuery(testcafe(t), [], role('textbox', { name: 'Code' }))
  await assert.rejects(name.fill('typed', { timeout: 300 }), /fill\(\) could not edit .*disabled/)
  await assert.rejects(code.fill('typed', { timeout: 300 }), /disabled/)
  assert.equal(await name.inputValue(), '')
  assert.equal(await code.inputValue(), '')
})

test("refuses to fill or clear a readonly input, fill('') included", async t => {
  await setContent(`<textarea aria-label="Notes" readonly>kept</textarea>`)
  const notes = createQuery(testcafe(t), [], role('textbox', { name: 'Notes' }))
  await assert.rejects(notes.fill('typed', { timeout: 300 }), /fill\(\) could not edit .*readonly/)
  await assert.rejects(notes.fill('', { timeout: 300 }), /fill\(\) could not edit .*readonly/)
  await assert.rejects(notes.clear({ timeout: 300 }), /clear\(\) could not edit .*readonly/)
  assert.equal(await notes.inputValue(), 'kept')
})

test('waits for an input to become editable before filling it', async t => {
  await setContent(`<input aria-label="Name" disabled>`)
  await ClientFunction(() => {
    setTimeout(() => document.querySelector('input')?.removeAttribute('disabled'), 200)
  })()
  const name = createQuery(testcafe(t), [], role('textbox', { name: 'Name' }))
  await name.fill('typed', { timeout: 3000 })
  assert.equal(await name.inputValue(), 'typed')
  await name.fill('')
  assert.equal(await name.inputValue(), '')
})

test('fills a contenteditable element', async t => {
  await setContent(`<div data-testid="editor" contenteditable="true">old</div>`)
  const editor = createQuery(testcafe(t), [], testId('editor'))
  await editor.fill('new')
  assert.equal(await editor.text(), 'new')
})

test('says currentUrl has nothing to report before the first read', async t => {
  const env = testcafe(t)
  assert.throws(() => navigationFor(env).currentUrl(env), /has not read the URL yet/)
  await createQuery(env, [], testId('stage')).count()
  assert.equal(navigationFor(env).currentUrl(env), `${FIXTURE}/`)
})

test('says what a TestCafe action failure means, and keeps its cause', async t => {
  await setContent(`<button data-testid="ghost" style="visibility: hidden">Ghost</button>`)
  const ghost = createQuery(testcafe(t), [], testId('ghost'))
  await assert.rejects(ghost.click({ timeout: 500 }), (error: Error) => {
    assert.match(error.message, /could not act on testId\(ghost\): it is not visible/)
    assert.match(error.message, /\(TestCafe error E26\)/)
    // Read structurally: TestCafe compiles this file against a library without `cause`.
    const { cause } = error as { cause?: { code?: string } }
    assert.equal(cause?.code, 'E26')
    return true
  })
})

test('an action spends one deadline, not the timeout and then more', async t => {
  const ghost = createQuery(testcafe(t), [], testId('ghost'))
  const hidden = `<button data-testid="ghost" style="visibility: hidden">Ghost</button>`
  const timedClick = async (): Promise<number> => {
    const started = Date.now()
    await assert.rejects(ghost.click({ timeout: 400 }), /it is not visible/)
    return Date.now() - started
  }
  // What a click on a node that is there from the start costs, TestCafe's own
  // overhead included…
  await setContent(hidden)
  const present = await timedClick()
  // …and a node found late must not be given more time than that.
  await setContent(`<div id="host"></div>`)
  await ClientFunction((html: string) => {
    setTimeout(() => {
      document.body.innerHTML = html
    }, 300)
  })(hidden)
  const late = await timedClick()
  assert.ok(late < present + 200, `a late node took ${late}ms, a present one ${present}ms`)
})

test("refuses the t imported from 'testcafe', which belongs to no one test", async () => {
  assert.throws(
    () => testcafe(sharedController),
    /pass the test function's own t, not the one imported from 'testcafe'/,
  )
})

test('reads display: contents as visible when what it contains is', async t => {
  await setContent(`<div data-testid="group" style="display: contents"><span>shown</span></div>`)
  const group = createQuery(testcafe(t), [], testId('group'))
  assert.equal(await group.isVisible(), true)
  await group.waitForVisible({ timeout: 1000 })
})

test('reads visibility: collapse as hidden', async t => {
  await setContent(`<div data-testid="row" style="visibility: collapse">gone</div>`)
  const row = createQuery(testcafe(t), [], testId('row'))
  assert.equal(await row.isVisible(), false)
  await row.waitForHidden({ timeout: 1000 })
})

// The paragraph holding the two late nodes renders late itself, so these wait
// for the scope and then answer at once — as the resolver-based drivers do.
test('count() waits for a scope that renders late', async t => {
  await t.navigateTo(`${FIXTURE}/${viewSearch('login-late-duplicates')}`)
  const late = createQuery(
    testcafe(t),
    [testId('login-form'), role('paragraph')],
    testId('login-late'),
  )
  assert.equal(await late.count(), 2)
})

test('texts() waits for a scope that renders late', async t => {
  await t.navigateTo(`${FIXTURE}/${viewSearch('login-late-duplicates')}`)
  const late = createQuery(
    testcafe(t),
    [testId('login-form'), role('paragraph')],
    testId('login-late'),
  )
  assert.deepEqual(await late.texts(), ['first', 'second'])
  assert.deepEqual(await late.nth(1).texts(), ['second'])
})

test('a read the caller gave up on does not hold up the next one', async t => {
  await setContent(`<p data-testid="here">here</p>`)
  const env = testcafe(t)
  const abandoned = createQuery(env, [], testId('never'))
    .text({ timeout: 4000 })
    .catch(() => undefined)
  await delay(100)
  const started = Date.now()
  assert.equal(await createQuery(env, [], testId('here')).text(), 'here')
  const elapsed = Date.now() - started
  assert.ok(elapsed < 2000, `the next read waited ${elapsed}ms behind an abandoned one`)
  await abandoned
})

test('a count the caller gave up on does not hold up the next read', async t => {
  await setContent(`<p data-testid="here">here</p>`)
  const env = testcafe(t)
  // What `isReady({ timeout })` does: race the count, and stop listening.
  const abandoned = createQuery(env, [testId('never')], testId('item')).count()
  await Promise.race([abandoned, delay(100)])
  const started = Date.now()
  assert.equal(await createQuery(env, [], testId('here')).text(), 'here')
  const elapsed = Date.now() - started
  assert.ok(elapsed < 2000, `the next read waited ${elapsed}ms behind an abandoned count`)
  assert.equal(await abandoned, 0)
})

test('a list read the caller gave up on does not hold up the next read', async t => {
  await setContent(`<p data-testid="here">here</p>`)
  const env = testcafe(t)
  const abandoned = createQuery(env, [testId('never')], testId('item')).texts()
  await Promise.race([abandoned, delay(100)])
  const started = Date.now()
  assert.equal(await createQuery(env, [], testId('here')).text(), 'here')
  const elapsed = Date.now() - started
  assert.ok(elapsed < 2000, `the next read waited ${elapsed}ms behind an abandoned list read`)
  assert.deepEqual(await abandoned, [])
})

test('count() and texts() keep the strict and nth rules for the scope', async t => {
  await setContent(
    `<ul data-testid="list"><li data-testid="item">a</li></ul>` +
      `<ul data-testid="list"><li data-testid="item">b</li><li data-testid="item">c</li></ul>`,
  )
  const env = testcafe(t)
  // An ambiguous scope holds nothing, at once; an indexed one is that one list.
  const started = Date.now()
  assert.equal(await createQuery(env, [testId('list')], testId('item')).count(), 0)
  assert.deepEqual(await createQuery(env, [testId('list')], testId('item')).texts(), [])
  assert.ok(Date.now() - started < 2000, 'an ambiguous scope was waited on')
  const second = createQuery(env, [{ ...testId('list'), nth: 1 }], testId('item'))
  assert.equal(await second.count(), 2)
  assert.deepEqual(await second.texts(), ['b', 'c'])
  assert.equal(await second.nth(1).count(), 1)
  assert.deepEqual(await second.nth(1).texts(), ['c'])
})

test('count() refuses a frame link on an element that is not an iframe', async t => {
  await setContent(`<div data-testid="pane"><p data-testid="item">x</p></div>`)
  const env = testcafe(t)
  await assert.rejects(
    createQuery(env, [{ ...testId('pane'), frame: true }], testId('item')).count(),
    /is marked as a frame but is a <div>/,
  )
})
