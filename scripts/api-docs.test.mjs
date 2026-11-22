// Builds the API reference (`pnpm docs:api`, after `pnpm build`) and checks what search engines
// and agents read from it: the pages, their meta, the sitemap and llms-full.txt.
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const base = 'https://joegaudet.com/harnessed/api/'

execFileSync('pnpm', ['docs:api'], { cwd: root, stdio: 'inherit' })

test('every published package has a page', () => {
  const index = read('docs/api/index.html')
  for (const dir of readdirSync(new URL('packages/', root))) {
    const pkg = JSON.parse(read(`packages/${dir}/package.json`))
    if (!pkg.private) assert.match(index, new RegExp(pkg.name.replace('/', '\\/')))
  }
})

test('pages carry canonical, link-preview and JSON-LD meta', () => {
  const page = read('docs/api/index.html')
  assert.match(page, new RegExp(`<link rel="canonical" href="${base}"`))
  assert.match(
    page,
    /<meta property="og:image" content="https:\/\/joegaudet.com\/harnessed\/og-image.png"/,
  )
  assert.match(page, /<meta name="twitter:card" content="summary_large_image"/)
  const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(page)[1])
  assert.equal(ld['@type'], 'TechArticle')
  assert.equal(ld.url, base)
})

test('pages use the marketing site styles', () => {
  assert.match(read('docs/api/index.html'), /assets\/custom.css/)
  assert.match(read('docs/api/assets/custom.css'), /--brand-violet/)
})

test('the sitemap lists absolute API URLs', () => {
  assert.match(read('docs/api/sitemap.xml'), new RegExp(`<loc>${base}`))
})

test('llms-full.txt is llms.txt plus the API reference', () => {
  const full = read('docs/api/llms-full.txt')
  assert.ok(full.startsWith(read('docs/site/llms.txt')))
  assert.match(full, /## API reference/)
  assert.match(full, /# Abstract Class: ComponentHarness/)
})

test('api.json is the TypeDoc model, for tools that read the API rather than the pages', () => {
  const model = JSON.parse(read('docs/api/api.json'))
  assert.equal(model.name, 'harnessed')
  assert.ok(model.children.some(child => child.name === '@harnessed-ts/core'))
})
