// Unit tests for the publish plan: run with `pnpm test:scripts`.
//
// node:test rather than vitest because the repository root has no vitest of its
// own -- each package brings its own -- and these scripts run under bare node.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { decide, preflight, publishAll, publishOrder, succeeded } from './publish-plan.mjs'

const pkg = (name, version, deps = {}, extra = {}) => ({
  dir: name.split('/').pop(),
  manifest: { name, version, dependencies: deps, ...extra },
})

const workspaceOf = pkgs => new Map(pkgs.map(p => [p.manifest.name, p.manifest]))

// The 0.4.0 release: core and a few drivers exist on the registry at 0.3.0,
// resolve has never been published, and dom depends on it.
const core = pkg('@h/core', '0.4.0')
const resolve = pkg('@h/resolve', '0.4.0', { '@h/core': 'workspace:^' })
const dom = pkg('@h/dom', '0.4.0', { '@h/core': 'workspace:^', '@h/resolve': 'workspace:^' })
const playwright = pkg('@h/playwright', '0.4.0', { '@h/core': 'workspace:^' })
const route = pkg('@h/route', '0.4.0', { '@h/dom': 'workspace:^' })
const release = [route, dom, playwright, resolve, core]
const registryBefore = new Map([
  ['@h/core', ['0.3.0']],
  ['@h/dom', ['0.3.0']],
  ['@h/playwright', ['0.3.0']],
  ['@h/route', ['0.3.0']],
])

const names = list => list.map(p => p.manifest.name)

describe('publishOrder', () => {
  it('puts every workspace dependency before its dependents', () => {
    const order = names(publishOrder(release))
    for (const [dep, dependent] of [
      ['@h/core', '@h/resolve'],
      ['@h/resolve', '@h/dom'],
      ['@h/dom', '@h/route'],
      ['@h/core', '@h/playwright'],
    ]) {
      assert.ok(order.indexOf(dep) < order.indexOf(dependent), `${dep} before ${dependent}`)
    }
    assert.equal(order.length, release.length)
  })

  it('orders peer dependencies too', () => {
    const plugin = pkg('@h/plugin', '1.0.0', {}, { peerDependencies: { '@h/host': '^1.0.0' } })
    const host = pkg('@h/host', '1.0.0')
    assert.deepEqual(names(publishOrder([plugin, host])), ['@h/host', '@h/plugin'])
  })
})

describe('preflight', () => {
  it('passes when every dependency is on the registry or in this publish', () => {
    assert.deepEqual(
      preflight({ packages: release, workspace: workspaceOf(release), registry: registryBefore }),
      [],
    )
  })

  it('passes when a dependency at the target version is already on the registry', () => {
    const registry = new Map([
      ['@h/core', ['0.4.0']],
      ['@h/resolve', ['0.4.0']],
    ])
    assert.deepEqual(
      preflight({ packages: [core, resolve, dom], workspace: workspaceOf(release), registry }),
      [],
    )
  })

  it('fails when a dependency is neither on the registry nor in this publish', () => {
    const hidden = pkg('@h/hidden', '0.4.0', {}, { private: true })
    const uses = pkg('@h/uses', '0.4.0', { '@h/hidden': 'workspace:^' })
    const problems = preflight({
      packages: [uses],
      workspace: workspaceOf([hidden, uses]),
      registry: new Map([['@h/hidden', ['0.3.0']]]),
    })
    assert.equal(problems.length, 1)
    assert.match(problems[0], /@h\/uses@0\.4\.0/)
    assert.match(problems[0], /@h\/hidden@0\.4\.0/)
  })

  it('checks peer dependencies too', () => {
    const hidden = pkg('@h/hidden', '0.4.0', {}, { private: true })
    const uses = pkg('@h/uses', '0.4.0', {}, { peerDependencies: { '@h/hidden': '^0.4.0' } })
    const problems = preflight({
      packages: [uses],
      workspace: workspaceOf([hidden, uses]),
      registry: new Map(),
    })
    assert.equal(problems.length, 1)
  })

  it('ignores a package that is already published', () => {
    const hidden = pkg('@h/hidden', '0.4.0', {}, { private: true })
    const uses = pkg('@h/uses', '0.4.0', { '@h/hidden': 'workspace:^' })
    const problems = preflight({
      packages: [uses],
      workspace: workspaceOf([hidden, uses]),
      registry: new Map([['@h/uses', ['0.4.0']]]),
    })
    assert.deepEqual(problems, [])
  })
})

describe('decide', () => {
  const workspace = workspaceOf(release)

  it('leaves an already-published version alone', () => {
    const decision = decide(dom.manifest, {
      published: ['0.4.0'],
      unavailable: new Set(['@h/resolve']),
      workspace,
    })
    assert.deepEqual(decision, { action: 'already' })
  })

  it('publishes when no workspace dependency is unavailable', () => {
    assert.deepEqual(decide(dom.manifest, { published: [], unavailable: new Set(), workspace }), {
      action: 'publish',
    })
  })

  it('skips a package whose dependency failed, naming the blocker', () => {
    assert.deepEqual(
      decide(dom.manifest, { published: [], unavailable: new Set(['@h/resolve']), workspace }),
      { action: 'skip', blockers: ['@h/resolve'] },
    )
  })

  it('skips a package whose peer dependency failed', () => {
    const plugin = pkg('@h/plugin', '1.0.0', {}, { peerDependencies: { '@h/host': '^1.0.0' } })
    const host = pkg('@h/host', '1.0.0')
    const decision = decide(plugin.manifest, {
      published: [],
      unavailable: new Set(['@h/host']),
      workspace: workspaceOf([plugin, host]),
    })
    assert.equal(decision.action, 'skip')
  })
})

describe('publishAll', () => {
  const run = async failing => {
    const attempted = []
    const lines = []
    const results = await publishAll({
      packages: release,
      workspace: workspaceOf(release),
      registry: registryBefore,
      publish: async ({ manifest }) => {
        attempted.push(manifest.name)
        if (failing.includes(manifest.name)) throw new Error(`E404 ${manifest.name}\nmore`)
      },
      log: line => lines.push(line),
    })
    return { attempted, lines, results }
  }

  it('publishes everything, dependencies first, when nothing fails', async () => {
    const { attempted, results } = await run([])
    assert.equal(attempted.length, release.length)
    assert.ok(attempted.indexOf('@h/resolve') < attempted.indexOf('@h/dom'))
    assert.equal(results.published.length, release.length)
    assert.ok(succeeded(results))
  })

  it('never publishes a dependent of a failed package, transitively', async () => {
    const { attempted, lines, results } = await run(['@h/resolve'])

    assert.ok(!attempted.includes('@h/dom'), 'dom depends on the failed resolve')
    assert.ok(!attempted.includes('@h/route'), 'route depends on the skipped dom')
    assert.deepEqual(results.failed, ['@h/resolve@0.4.0'])
    assert.deepEqual(results.skipped.sort(), ['@h/dom@0.4.0', '@h/route@0.4.0'])
    // Unrelated packages still go out: a re-run picks up only what is missing.
    assert.deepEqual(results.published.sort(), ['@h/core@0.4.0', '@h/playwright@0.4.0'])
    assert.ok(lines.some(line => /@h\/dom@0\.4\.0.*@h\/resolve/.test(line)))
    assert.ok(!succeeded(results))
  })

  it('reports packages already on the registry without publishing them', async () => {
    const attempted = []
    const results = await publishAll({
      packages: [core],
      workspace: workspaceOf([core]),
      registry: new Map([['@h/core', ['0.4.0']]]),
      publish: async ({ manifest }) => attempted.push(manifest.name),
      log: () => {},
    })
    assert.deepEqual(attempted, [])
    assert.deepEqual(results.already, ['@h/core@0.4.0'])
    assert.ok(succeeded(results))
  })
})

describe('succeeded', () => {
  const empty = { published: [], already: [], failed: [], skipped: [] }

  it('is false when anything failed or was skipped', () => {
    assert.equal(succeeded({ ...empty, failed: ['a@1.0.0'] }), false)
    assert.equal(succeeded({ ...empty, skipped: ['a@1.0.0'] }), false)
    assert.equal(succeeded(empty), true)
  })
})
