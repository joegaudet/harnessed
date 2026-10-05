import { describe } from 'vitest';
import { render, visit } from '@ember/test-helpers';
import { applicationTest, renderingTest } from 'ember-vitest';
import { pageSpecs, specs, urlSpecs, viewSearch } from '@harnessed-ts/conformance';
import type { ConformanceCtx, View } from '@harnessed-ts/conformance';
import { ember } from '@harnessed-ts/ember';
import App from 'test-app-ember-vite/app';
import ConformanceApp from 'test-app-ember-vite/components/fixture/conformance-app';

/**
 * The catalog again, under Vitest browser mode in the describe/it style of a
 * BDD suite. ember-vitest sets up the same @ember/test-helpers contexts
 * ember-qunit does, so the driver is unchanged — only the runner differs.
 */
const rendering = renderingTest.extend('app', () => App);
const application = applicationTest.extend('app', () => App);

const rendered: ConformanceCtx = {
  async show(view: View) {
    const url = `/${viewSearch(view)}`;
    await render(<template><ConformanceApp @url={{url}} /></template>);
    return ember();
  },
};

const visited: ConformanceCtx = {
  async show(view: View) {
    await visit(`/${viewSearch(view)}`);
    return ember();
  },
};

describe('conformance: ember under Vitest (rendering)', () => {
  for (const spec of specs) {
    rendering(spec.name, () => spec.run(rendered));
  }
  for (const spec of pageSpecs) {
    rendering(`page: ${spec.name}`, () => spec.run(rendered));
  }
});

describe('conformance: ember under Vitest (application)', () => {
  for (const spec of pageSpecs) {
    application(`page: ${spec.name}`, () => spec.run(visited));
  }
  for (const spec of urlSpecs) {
    application(`url: ${spec.name}`, () => spec.run({ env: ember() }));
  }
});
