import { setupApplicationTest, setupRenderingTest, setupTest } from 'ember-qunit'
import { setupMocks } from '@harnessed-ts/ember/mock'

/**
 * ember-cli-yadda's hooks, which every compiled feature imports. The shared
 * feature carries no annotations — it runs unchanged under every adapter — so a
 * feature without a setup annotation is an application test here: its pages
 * `goto()` through the router.
 */
type Annotations = Record<string, unknown>
type Setup = (hooks: NestedHooks) => void

export function runFeature(_annotations: Annotations): undefined {
  return undefined
}

export function runScenario(
  _featureAnnotations: Annotations,
  _scenarioAnnotations: Annotations,
): undefined {
  return undefined
}

export function setupFeature(annotations: Annotations): Setup {
  if (annotations['setuprenderingtest']) return setupRenderingTest
  if (annotations['setuptest']) return setupTest
  // Every scenario's mocks are ended after it, as `setupMocks` does for a module.
  return hooks => {
    setupApplicationTest(hooks)
    setupMocks(hooks)
  }
}

export function setupScenario(
  _featureAnnotations: Annotations,
  _scenarioAnnotations: Annotations,
): undefined {
  return undefined
}
