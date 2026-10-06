import { describe, expect, it } from 'vitest'
import { parseArgs, USAGE } from '../src/args'

describe('the CLI arguments', () => {
  it('takes --runners as the runners to document', () => {
    const { layout } = parseArgs(['install', '--runners', 'ember,cypress'])
    expect(layout.runners).toEqual(['ember', 'cypress'])
  })

  it('refuses an unknown runner, naming it', () => {
    expect(() => parseArgs(['install', '--runners', 'ember,jasmine'])).toThrow(
      /unknown runner "jasmine"/,
    )
  })

  it('leaves the runners to detection when --runners is not given', () => {
    expect(parseArgs(['install', '--dry-run']).layout.runners).toBeUndefined()
  })

  it('refuses a flag missing its value', () => {
    expect(() => parseArgs(['install', '--runners'])).toThrow(/--runners needs a value/)
  })

  it('documents --runners and the known runners in --help', () => {
    expect(USAGE).toMatch(/--runners <list>/)
    expect(USAGE).toMatch(/vitest-browser/)
  })
})
