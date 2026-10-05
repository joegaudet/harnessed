import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { fixtureTree, fixtureTrees, viewSearch } from '@harnessed-ts/conformance';
import type { View } from '@harnessed-ts/conformance';
import ConformanceApp from 'test-app-ember-classic/components/fixture/conformance-app';

/**
 * The Glimmer fixture must render what the React one does, view for view: the
 * catalog passing here only means the drivers agree if both fixtures are the
 * same markup. The React side is pinned to the same trees by the conformance
 * package's own test.
 */
module('conformance: Glimmer fixture parity', function (hooks) {
  setupRenderingTest(hooks);

  for (const view of Object.keys(fixtureTrees) as View[]) {
    test(`"${view}" renders the same tree as the React fixture`, async function (assert) {
      const url = `/${viewSearch(view)}`;
      await render(<template><ConformanceApp @url={{url}} /></template>);
      const stage = document.querySelector('#ember-testing [data-testid="stage"]');
      assert.ok(stage, 'the stage rendered');
      assert.deepEqual(fixtureTree(stage!), fixtureTrees[view]);
    });
  }
});
