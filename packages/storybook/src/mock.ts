/**
 * `harnessed()` with API mocking: a story (or its meta) declares the mocks it
 * needs in `parameters.harnessed.mocks`, and they are installed before it
 * renders — in the Storybook UI as well as under test — and ended before the
 * next story. `play` receives the mock as `context.mocks`, to override a route
 * or assert on what was requested.
 *
 * ```ts
 * // .storybook/preview.ts
 * import { harnessed } from '@harnessed-ts/storybook/mock'
 * export default { ...harnessed() } satisfies Preview
 *
 * // UserCard.stories.ts
 * export const Loaded: Story = {
 *   parameters: { harnessed: { mocks: [UsersApi] } },
 * }
 * export const Failing: Story = {
 *   parameters: { harnessed: { mocks: [http.get('/api/users/:id', () => serverError())] } },
 * }
 * ```
 *
 * Requests are intercepted in the preview through `@mswjs/interceptors`
 * (install it alongside).
 */
import { mock, resetMocks } from '@harnessed-ts/dom/mock'
import type { ApiMock, Mockable, MockOptions } from '@harnessed-ts/dom/mock'
import { harnessed as base } from './index'
import type { HarnessedContext, HarnessedOptions } from './index'

/** What a story may set under `parameters.harnessed`. */
export interface HarnessedParameters extends MockOptions {
  /** Handlers, API harnesses and MSW handlers, installed before the story renders. */
  mocks?: Mockable[]
}

/** The story context `play` receives, with the story's mock. */
export interface MockedContext extends HarnessedContext {
  mocks?: ApiMock
}

export function harnessed(options: Omit<HarnessedOptions, 'hook'> = {}): ReturnType<typeof base> {
  return base({
    ...options,
    hook: async (context, env) => {
      const { mocks, ...options } = (context.parameters.harnessed ?? {}) as HarnessedParameters
      if (mocks === undefined || mocks.length === 0) return undefined
      const api = mock(env, options)
      await api.use(...mocks)
      ;(context as MockedContext).mocks = api
      // Storybook runs this before the next story: its mocks must not outlive it.
      return () => resetMocks()
    },
  })
}

export * from '@harnessed-ts/dom/mock'
