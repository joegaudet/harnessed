import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

/**
 * The packages publish both ESM and CJS. A consumer whose graph pulls in both
 * formats loads two copies of every module, so anything kept in module scope would
 * exist twice — a driver registered through one copy would be invisible to a
 * harness constructed through the other. State lives on `globalThis` under a
 * `Symbol.for` key precisely so that cannot happen.
 */
const require = createRequire(import.meta.url)
const esm = await import('@harnessed-ts/core')
const cjs = require('@harnessed-ts/core') as typeof esm

describe('dual publish', () => {
  it('really does load two separate module instances', () => {
    // Hoisted so this guard covers every test below: without it they would all
    // pass trivially against a single shared instance.
    expect(cjs).not.toBe(esm)
    expect(cjs.registerDriver).not.toBe(esm.registerDriver)
  })

  it('shares one driver registry between the ESM and CJS copies', () => {
    esm.registerDriver('dual-publish-probe', () => {
      throw new Error('not called')
    })

    expect(cjs.registeredDrivers()).toContain('dual-publish-probe')
    expect(esm.registeredDrivers()).toContain('dual-publish-probe')
  })

  it('shares one runtime config between the ESM and CJS copies', () => {
    esm.configure({ testIdAttribute: 'data-probe-id' })
    expect(cjs.getConfig().testIdAttribute).toBe('data-probe-id')

    cjs.resetConfig()
    expect(esm.getConfig().testIdAttribute).toBe('data-testid')
  })

  it('resolves the host of a class decorated through the other copy', () => {
    class Probe extends esm.ComponentHarness {}
    // Decorate via the CJS copy, resolve via the ESM one.
    cjs.Harness({ host: cjs.testId('probe-host') })(Probe, {} as ClassDecoratorContext)

    expect(esm.findHostMeta(Probe)).toEqual({ host: { type: 'testId', testId: 'probe-host' } })
  })
})
