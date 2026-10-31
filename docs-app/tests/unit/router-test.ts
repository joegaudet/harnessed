import { module, test } from 'qunit'
import { outsideRoot } from 'docs-app/router'

module('Unit | outsideRoot', function () {
  test('matches paths outside the guide, so the browser follows them', function (assert) {
    const pattern = new RegExp(outsideRoot('/harnessed/guide/'))
    assert.true(pattern.test('/'))
    assert.true(pattern.test('/harnessed/'))
    assert.true(pattern.test('/real-enums/'))
    assert.false(pattern.test('/harnessed/guide/'))
    assert.false(pattern.test('/harnessed/guide/getting-started/install'))
  })

  test('matches nothing when the guide is served from the root', function (assert) {
    assert.false(new RegExp(outsideRoot('/')).test('/anything'))
  })
})
