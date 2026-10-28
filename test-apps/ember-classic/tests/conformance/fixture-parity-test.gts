import { module, test } from 'qunit';
import { setupRenderingTest } from 'ember-qunit';
import { render } from '@ember/test-helpers';
import { fixtureParity } from '@harnessed-ts/conformance';
import { ember } from '@harnessed-ts/ember';
import { hang, mock, setupMocks } from '@harnessed-ts/ember/mock';
import ConformanceApp from 'test-app-ember-classic/components/fixture/conformance-app';

/**
 * The Glimmer fixture must render what the React one does, view for view: the
 * catalog passing here only means the drivers agree if both fixtures are the
 * same markup. The React side is pinned to the same trees by the conformance
 * package's own test.
 */
module('conformance: Glimmer fixture parity', function (hooks) {
  setupRenderingTest(hooks);
  setupMocks(hooks);

  // One test per view; fixtureParity throws naming the first place the trees part.
  fixtureParity(
    (name, body) =>
      test(name, async function (assert) {
        await body();
        assert.ok(true, 'the trees match');
      }),
    async (url, view) => {
      // The data view loads as it mounts. React's tree is read in the same tick
      // as the render, so pin this one with the request still in flight too.
      if (view === 'data') await mock(ember()).get('/api/users/:id').reply(hang());
      await render(<template><ConformanceApp @url={{url}} /></template>);
      return document.querySelector('#ember-testing [data-testid="stage"]');
    },
  );
});
