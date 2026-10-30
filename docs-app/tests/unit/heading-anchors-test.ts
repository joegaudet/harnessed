import { module, test } from 'qunit'
import { linkHeadings } from 'docs-app/heading-anchors'

function prose(): HTMLElement {
  const element = document.createElement('article')
  element.innerHTML =
    '<h1>Title</h1><h2 id="setup">Setup</h2><p>…</p><h3 id="more">More</h3><h2>No id</h2>'
  return element
}

module('Unit | linkHeadings', function () {
  test('gives every h2 and h3 with an id a link to itself', function (assert) {
    const element = prose()
    linkHeadings(element, '')
    assert.dom('#setup a.heading-anchor', element).hasAttribute('href', '#setup')
    assert.dom('#more a.heading-anchor', element).hasAttribute('href', '#more')
    assert.dom('h1 a', element).doesNotExist()
    assert.strictEqual(element.querySelectorAll('a.heading-anchor').length, 2)
    assert.dom('#setup a.heading-anchor', element).hasAttribute('aria-label', 'Link to “Setup”')
  })

  test('scrolls to the heading the hash names', function (assert) {
    const element = prose()
    const scrolled: string[] = []
    element.querySelector('#more')!.scrollIntoView = () => scrolled.push('more')
    assert.true(linkHeadings(element, '#more'), 'it found the target')
    assert.deepEqual(scrolled, ['more'])
  })

  test('ignores a hash that names nothing, and running twice adds one link', function (assert) {
    const element = prose()
    assert.false(linkHeadings(element, '#nothing'), 'not there (yet)')
    linkHeadings(element, '')
    assert.strictEqual(element.querySelectorAll('a.heading-anchor').length, 2)
  })
})
