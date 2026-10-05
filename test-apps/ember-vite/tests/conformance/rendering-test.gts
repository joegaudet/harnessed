import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { pageSpecs, specs, viewSearch } from '@harnessed-ts/conformance';
import type { ConformanceCtx, View } from '@harnessed-ts/conformance';
import { ember } from '@harnessed-ts/ember';
import ConformanceApp from 'test-app-ember-vite/components/fixture/conformance-app';

/**
 * The whole catalog in rendering tests: the view is rendered, not visited —
 * the shape of most Ember component tests. Every spec, no opt-outs.
 */
const ctx: ConformanceCtx = {
  async show(view: View) {
    const url = `/${viewSearch(view)}`;
    await render(<template><ConformanceApp @url={{url}} /></template>);
    return ember();
  },
};

module('conformance: ember (rendering)', function (hooks) {
  setupRenderingTest(hooks);

  for (const spec of specs) {
    test(spec.name, async function (assert) {
      // The catalog asserts through its own module; a throw fails the test.
      assert.expect(0);
      await spec.run(ctx);
    });
  }

  for (const spec of pageSpecs) {
    test(`page: ${spec.name}`, async function (assert) {
      assert.expect(0);
      await spec.run(ctx);
    });
  }
});
