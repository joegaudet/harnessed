import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

/**
 * The packages publish both ESM and CJS. A consumer whose graph pulls in both
 * formats loads two copies of every module, so anything kept in module scope would
 * exist twice — a driver registered through one copy would be invisible to a
 * harness constructed through the other. State lives on `globalThis` under a
 * `Symbol.for` key precisely so that cannot happen.
 */
describe('dual publish', () => {
  it('shares one driver registry between the ESM and CJS copies', async () => {
    const require = createRequire(import.meta.url)

    const esm = await import('@harnessed/core')
    const cjs = require('@harnessed/core') as typeof esm

    // Genuinely two module instances, or this proves nothing.
    expect(cjs).not.toBe(esm)
    expect(cjs.registerDriver).not.toBe(esm.registerDriver)

    esm.registerDriver('dual-publish-probe', () => {
      throw new Error('not called')
    })

    expect(cjs.registeredDrivers()).toContain('dual-publish-probe')
    expect(esm.registeredDrivers()).toContain('dual-publish-probe')
  })

  it('shares one runtime config between the ESM and CJS copies', async () => {
    const require = createRequire(import.meta.url)
    const esm = await import('@harnessed/core')
    const cjs = require('@harnessed/core') as typeof esm

    esm.configure({ testIdAttribute: 'data-probe-id' })
    expect(cjs.getConfig().testIdAttribute).toBe('data-probe-id')

    cjs.resetConfig()
    expect(esm.getConfig().testIdAttribute).toBe('data-testid')
  })

  it('resolves the host of a class decorated through the other copy', async () => {
    const require = createRequire(import.meta.url)
    const esm = await import('@harnessed/core')
    const cjs = require('@harnessed/core') as typeof esm

    class Probe extends esm.ComponentHarness {}
    // Decorate via the CJS copy, resolve via the ESM one.
    cjs.Harness({ host: cjs.testId('probe-host') })(Probe, {} as ClassDecoratorContext)

    expect(esm.findHostMeta(Probe)).toEqual({ host: { type: 'testId', testId: 'probe-host' } })
  })
})
