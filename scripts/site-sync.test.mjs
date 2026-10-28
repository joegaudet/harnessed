// Keeps the marketing site in step with CI: run with `pnpm test:scripts`.
//
// docs/site/index.html is hand-written, and nothing regenerates it when a
// runner gains or loses conformance. These checks catch the two ways it drifts:
// a conformance workflow with no badge on the page, and a hero box drawn one way
// ("not yet" dashed, or solid) while CI says the other.
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const ROOT = new URL('..', import.meta.url)
const SITE = readFileSync(new URL('docs/site/index.html', ROOT), 'utf8')
const WORKFLOWS = readdirSync(new URL('.github/workflows/', ROOT)).filter(
  // conformance-driver.yml is the reusable job every caller runs, not a run itself.
  name => /^conformance-.+\.yml$/.test(name) && name !== 'conformance-driver.yml',
)

/** Every `<tag …>` in `block`, with its attributes. */
function tags(block, tag) {
  return [...block.matchAll(new RegExp(`<${tag}\\b([^>]*)>([^<]*)`, 'g'))].map(match => {
    const attrs = Object.fromEntries(
      [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]),
    )
    return { attrs, text: match[2].trim(), todo: /\btodo\b/.test(attrs.class ?? '') }
  })
}

function group(name) {
  const match = new RegExp(`<g class="${name}"[^>]*>([\\s\\S]*?)</g>`).exec(SITE)
  assert.ok(match, `the hero has a <g class="${name}">`)
  return match[1]
}

/** The workflow a hero label stands for: "Bun test" → conformance-bun-test.yml. */
function workflowFor(label) {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `conformance-${slug}.yml`
}

/**
 * The hero's boxes, each with its label, its rope, and whether each is drawn
 * as "not yet". A rope starts at its framework's box (x 150) or ends at its
 * runner's (x 570), at the label's y.
 */
function boxes() {
  const ropes = new Map(
    tags(SITE, 'path')
      .filter(path => /^rope-\d+$/.test(path.attrs.id ?? ''))
      .map(path => [path.attrs.id, path.attrs.d]),
  )
  const ropeAt = (x, y) =>
    [...ropes].find(([, d]) =>
      x < 360 ? d.startsWith(`M150 ${y} `) : d.endsWith(` 570 ${y}`),
    )?.[0]
  const drawn = new Map(tags(group('ropes'), 'use').map(use => [use.attrs.href.slice(1), use]))
  const pulsing = new Set(tags(group('pulses'), 'use').map(use => use.attrs.href.slice(1)))
  const rects = tags(group('nodes'), 'rect')
  return tags(group('labels'), 'text')
    .filter(label => !/\bgherkin\b/.test(label.attrs.class ?? ''))
    .map(label => {
      const x = Number(label.attrs.x)
      const y = Number(label.attrs.y)
      const rope = ropeAt(x, y)
      // Boxes are 28 tall, with the label centred.
      const rect = rects.find(r => Number(r.attrs.x) + 70 === x && Number(r.attrs.y) + 14 === y)
      return { label: label.text, todo: label.todo, rope, rect, drawn: drawn.get(rope), pulsing }
    })
}

describe('docs/site/index.html', () => {
  for (const workflow of WORKFLOWS) {
    it(`shows the ${workflow} badge`, () => {
      assert.ok(
        SITE.includes(`actions/workflows/${workflow}/badge.svg`),
        `${workflow} runs the conformance catalog, so the site's runner table shows its badge`,
      )
    })
  }

  it('draws every hero box, its label and its rope the same way', () => {
    for (const box of boxes()) {
      assert.ok(box.rope, `"${box.label}" has a rope`)
      assert.ok(box.rect, `"${box.label}" has a box`)
      assert.ok(box.drawn, `"${box.label}"'s rope is drawn`)
      assert.equal(box.rect.todo, box.todo, `"${box.label}"'s box and label agree on "not yet"`)
      assert.equal(box.drawn.todo, box.todo, `"${box.label}"'s rope and label agree on "not yet"`)
      assert.equal(
        box.pulsing.has(box.rope),
        !box.todo,
        `"${box.label}" ${box.todo ? 'is not yet supported, so its rope does not pulse' : 'is supported, so its rope pulses'}`,
      )
    }
  })

  it('draws no box as "not yet" that CI already runs', () => {
    for (const box of boxes().filter(b => b.todo)) {
      assert.ok(
        !WORKFLOWS.includes(workflowFor(box.label)),
        `${workflowFor(box.label)} runs "${box.label}" in CI, so its hero box is drawn solid`,
      )
    }
  })
})
