import {
  ByTestId,
  ComponentHarness,
  configure,
  createQuery,
  Harness,
  resetConfig,
  testId,
} from '@harnessed-ts/core'
import type { Query } from '@harnessed-ts/core'
import { dom } from '@harnessed-ts/dom'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { addons, mockChannel } from 'storybook/preview-api'
import { PLAY_FUNCTION_THREW_EXCEPTION } from 'storybook/internal/core-events'
import { harnessed, PLAY_ERROR_ATTRIBUTE, STORY_READY_TEST_ID } from '../src/index'
import type { HarnessedContext } from '../src/index'

@Harness({ host: testId('greeting') })
class GreetingHarness extends ComponentHarness {
  @ByTestId('name') private accessor name!: Query

  async greet(name: string): Promise<void> {
    await this.name.fill(name)
  }
}

function storyContext(harness?: typeof GreetingHarness): HarnessedContext & { labels: string[] } {
  const canvasElement = document.createElement('div')
  canvasElement.innerHTML = '<div data-testid="greeting"><input data-testid="name" /></div>'
  document.body.append(canvasElement)
  const labels: string[] = []
  return {
    canvasElement,
    parameters: harness === undefined ? {} : { harness },
    userEvent: userEvent.setup(),
    labels,
    async step(label, play) {
      labels.push(label)
      await play()
    },
  }
}

addons.setChannel(mockChannel())

const marker = () => createQuery(dom({ user: userEvent.setup() }), [], testId(STORY_READY_TEST_ID))

afterEach(() => {
  document.body.innerHTML = ''
})

describe('harnessed()', () => {
  it('puts the named harness on the context, logging each method as a step', async () => {
    const context = storyContext(GreetingHarness)
    await harnessed().beforeEach(context)

    await (context.harness as GreetingHarness).greet('Ada')

    expect(context.labels).toEqual(['GreetingHarness.greet("Ada")'])
    expect(context.canvasElement.querySelector('input')?.value).toBe('Ada')
  })

  it('awaits afterAction once each interaction is done, before the method resolves', async () => {
    const context = storyContext(GreetingHarness)
    const seen: string[] = []
    await harnessed({
      afterAction: async () => {
        seen.push(context.canvasElement.querySelector('input')?.value ?? '')
      },
    }).beforeEach(context)

    await (context.harness as GreetingHarness).greet('Ada')

    expect(seen).toEqual(['Ada'])
  })

  it('leaves the context alone when no harness is named', async () => {
    const context = storyContext()
    await harnessed().beforeEach(context)
    expect(context.harness).toBeUndefined()
  })

  it('marks the story ready after play, once, and clears the mark on the next render', async () => {
    const preview = harnessed()
    const context = storyContext(GreetingHarness)
    await preview.beforeEach(context)
    expect(await marker().count()).toBe(0)

    await preview.afterEach(context)
    await preview.afterEach(context)
    expect(await marker().count()).toBe(1)

    await preview.beforeEach(context)
    expect(await marker().count()).toBe(0)
  })

  it('marks the story ready under a data-test-* config, where StoryPage looks for it', async () => {
    configure({ testIdAttribute: 'data-test-*' })
    try {
      const preview = harnessed()
      const context = storyContext()
      await preview.beforeEach(context)
      await preview.afterEach(context)
      // testId() under this config matches only `data-test-harnessed-story-ready`.
      expect(await marker().count()).toBe(1)

      await preview.beforeEach(context)
      expect(await marker().count()).toBe(0)
    } finally {
      resetConfig()
    }
  })

  it('records a play function that threw on the mark, so a runner can report it', async () => {
    const preview = harnessed()
    const context = storyContext(GreetingHarness)
    await preview.beforeEach(context)
    addons.getChannel().emit(PLAY_FUNCTION_THREW_EXCEPTION, { name: 'Error', message: 'boom' })
    await preview.afterEach(context)
    expect(await marker().attribute(PLAY_ERROR_ATTRIBUTE)).toBe('boom')

    // The next render starts clean.
    await preview.beforeEach(context)
    await preview.afterEach(context)
    expect(await marker().attribute(PLAY_ERROR_ATTRIBUTE)).toBeNull()
  })
})
