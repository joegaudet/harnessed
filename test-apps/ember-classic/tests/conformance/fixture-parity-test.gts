import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { fixtureParity } from '@harnessed-ts/conformance';
import ConformanceApp from 'test-app-ember-classic/components/fixture/conformance-app';

/**
 * The Glimmer fixture must render what the React one does, view for view: the
 * catalog passing here only means the drivers agree if both fixtures are the
 * same markup. The React side is pinned to the same trees by the conformance
 * package's own test.
 */
module('conformance: Glimmer fixture parity', function (hooks) {
  setupRenderingTest(hooks);

  // One test per view; fixtureParity throws naming the first place the trees part.
  fixtureParity(
    (name, body) =>
      test(name, async function (assert) {
        await body();
        assert.ok(true, 'the trees match');
      }),
    async (url) => {
      await render(<template><ConformanceApp @url={{url}} /></template>);
      return document.querySelector('#ember-testing [data-testid="stage"]');
    },
  );
});
