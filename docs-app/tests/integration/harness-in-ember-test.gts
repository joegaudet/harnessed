import { module, test } from 'qunit'
import { setupRenderingTest } from 'docs-app/tests/helpers'
import { render, getRootElement } from '@ember/test-helpers'
import userEvent from '@testing-library/user-event'
import { dom } from '@harnessed-ts/dom'
// The guide's live examples drive Ember components with real harnesses: this proves the
// app's Babel pipeline compiles a harness's standard decorators (via @harnessed-ts/core/babel).
import { GreeterHarness } from '../harness/greeter.harness.ts'

module('Integration | a harness drives an Ember component', function (hooks) {
  setupRenderingTest(hooks)

  test('fills a field and reads the result through the DOM driver', async function (assert) {
    await render(
      <template>
        <div data-testid="greeter">
          <label>Name <input oninput="this.nextElementSibling.textContent = 'Hi ' + this.value" /><output data-testid="greeting"></output></label>
        </div>
      </template>,
    )

    const greeter = new GreeterHarness(dom({ user: userEvent.setup(), container: getRootElement() as HTMLElement }))

    assert.strictEqual(await greeter.greet('Ada'), 'Hi Ada')
  })
})
