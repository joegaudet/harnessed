import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { fixtureTree, fixtureTrees, viewSearch, VIEWS } from '@harnessed-ts/conformance';
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

  // VIEWS is checked against the View type, so a new view cannot be skipped.
  for (const view of VIEWS) {
    test(`"${view}" renders the same tree as the React fixture`, async function (assert) {
      const url = `/${viewSearch(view)}`;
      await render(<template><ConformanceApp @url={{url}} /></template>);
      const stage = document.querySelector('#ember-testing [data-testid="stage"]');
      assert.ok(fixtureTrees[view], `fixture/trees.json pins "${view}"`)
      assert.ok(stage, 'the stage rendered');
      assert.deepEqual(fixtureTree(stage!), fixtureTrees[view]);
    });
  }
});
