import { module, test } from 'qunit'
import { setupRenderingTest } from 'docs-app/tests/helpers'
import { render, clearRender, getRootElement } from '@ember/test-helpers'
import userEvent from '@testing-library/user-event'
import { dom } from '@harnessed-ts/dom'
import { reactIsland } from 'docs-app/modifiers/react-island'
import { Greeter } from '../react/Greeter.tsx'
import { GreeterHarness } from '../harness/greeter.harness.ts'

module('Integration | modifier | react-island', function (hooks) {
  setupRenderingTest(hooks)

  test('the same harness drives a React component mounted in Ember', async function (assert) {
    await render(<template><div {{reactIsland Greeter}}></div></template>)

    const greeter = new GreeterHarness(dom({ user: userEvent.setup(), container: getRootElement() as HTMLElement }))

    assert.strictEqual(await greeter.greet('Ada'), 'Hi Ada')
  })

  test('unmounts the React root when Ember tears the element down', async function (assert) {
    await render(<template><div {{reactIsland Greeter}}></div></template>)
    assert.dom('[data-testid="greeter"]').exists()

    await clearRender()

    assert.dom('[data-testid="greeter"]').doesNotExist()
  })
})
