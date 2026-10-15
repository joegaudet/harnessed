import { Harness, testId, timeoutFor } from '@harnessed-ts/core'
import type { EnvConfig, ScopedHarness, ScopedHarnessConstructor } from '@harnessed-ts/core'
import { PageHarness } from '@harnessed-ts/page'
import { storyNameFromExport, toId } from 'storybook/internal/csf'
import { PLAY_ERROR_ATTRIBUTE, STORY_READY_TEST_ID } from './ready'

/** A CSF module as imported with `import * as Stories from './X.stories'`. */
export interface StoriesModule {
  default: { title?: string; id?: string }
}

/** The export names in a CSF module that are stories, not the meta. */
export type StoryName<M extends StoriesModule> = Exclude<keyof M, 'default'> & string

/** The args a story declares, all optional: a URL overrides some, never must set all. */
export type StoryArgs<M extends StoriesModule, K extends StoryName<M>> = Partial<
  ArgsOf<M[K]> & ArgsOf<M['default']>
>

// An empty record rather than `never` when there are none: a meta without
// `args` must not erase the story's own.
type ArgsOf<T> = T extends { args?: infer A } ? NonNullable<A> : Record<never, never>

export interface StoryOptions<Args> {
  /**
   * Overrides for the story's args, encoded in Storybook's own URL syntax.
   * Storybook applies one only when the arg has an argType — inferred from the
   * component's props, or declared in `argTypes` — and drops it otherwise.
   */
  args?: Args
  /** Toolbar globals — theme, locale, viewport. */
  globals?: Record<string, Scalar>
  /**
   * Whether the story's play function runs. Defaults to `true`, as it does in
   * Storybook; `false` opens the story in its initial state for the test to drive.
   */
  play?: boolean
}

type Scalar = string | number | boolean | null | undefined

// Storybook's own rules (storybook/internal/router): it silently drops any arg
// that fails them, so a test would run against the wrong state. Refuse instead.
const SAFE_KEY = /^[a-zA-Z0-9 _-]+$/
// Storybook reads a numeric-looking string back as a number, so '02134' would
// arrive as 2134: letters, digits, spaces, `_` and `-`, but not a number.
const SAFE_STRING = /^[a-zA-Z0-9 _-]*$/
const NUMERIC = /^-?[0-9]+(\.[0-9]+)?$/

/**
 * The iframe URL of one story — id from the meta and export name, exactly as
 * Storybook derives it — relative to the Storybook root.
 */
export function storyUrl<M extends StoriesModule, K extends StoryName<M>>(
  stories: M,
  name: K,
  options: StoryOptions<StoryArgs<M, K>> = {},
): string {
  const title = stories.default.id ?? stories.default.title
  if (title === undefined) {
    throw new Error(
      `harnessed: the stories module for "${name}" has no \`title\` on its default export, ` +
        'so its story id cannot be derived outside Storybook. Fix: set `title` on the meta ' +
        '(or `id`, if the story id must not follow the title).',
    )
  }
  const params = [`id=${toId(title, storyNameFromExport(name))}`, 'viewMode=story']
  const args = encode(options.args ?? {})
  if (args !== '') params.push(`args=${args}`)
  const globals = encode(options.globals ?? {})
  if (globals !== '') params.push(`globals=${globals}`)
  // The switch Storybook itself reads: an embedded story renders without autoplay.
  if (options.play === false) params.push('embed=true')
  return `/iframe.html?${params.join('&')}`
}

function encode(values: Record<string, unknown>): string {
  return Object.entries(values)
    .map(([key, value]) => `${key}:${encodeValue(key, value)}`)
    .join(';')
}

function encodeValue(key: string, value: unknown): string {
  if (SAFE_KEY.test(key)) {
    if (value === undefined) return '!undefined'
    if (value === null) return '!null'
    if (typeof value === 'boolean') return `!${value}`
    // NaN, Infinity and exponents (`1e+21`, whose `+` reads back as a space) do not survive.
    if (typeof value === 'number' && NUMERIC.test(String(value))) return String(value)
    if (typeof value === 'string' && SAFE_STRING.test(value) && !NUMERIC.test(value)) {
      return value.replaceAll(' ', '+')
    }
  }
  throw new Error(
    `harnessed: arg \`${key}\` = ${typeof value === 'number' ? value : JSON.stringify(value)} cannot travel in a Storybook URL — ` +
      'Storybook drops anything but letters, digits, spaces, `_`, `-`, numbers and booleans ' +
      '(and reads a numeric string back as a number), so the story would render without it. ' +
      'Fix: add a story with that state in its `args`.',
  )
}

/**
 * One Storybook story, opened as a fixture by any runner that can navigate.
 *
 * ```ts
 * import * as LoginStories from './LoginForm.stories'
 * const story = await StoryPage.goto(pw(page), LoginStories, 'Default', { play: false })
 * const form = story.harness(LoginFormHarness)
 * ```
 *
 * Ready means rendered *and* played: it waits for the node `harnessed()` adds
 * after the story's play function finishes, so `.storybook/preview.ts` must
 * spread `harnessed()`.
 */
@Harness({ host: testId(STORY_READY_TEST_ID) })
export class StoryPage extends PageHarness {
  #url = ''

  static async goto<M extends StoriesModule, K extends StoryName<M>>(
    env: EnvConfig,
    stories: M,
    name: K,
    options?: StoryOptions<StoryArgs<M, K>>,
  ): Promise<StoryPage> {
    const story = new StoryPage(env)
    story.#url = storyUrl(stories, name, options)
    await story.goto()
    return story
  }

  override get path(): string {
    return this.#url
  }

  /** A harness for something in the story, scoped to the whole iframe. */
  harness<T extends ScopedHarness>(HarnessClass: ScopedHarnessConstructor<T>): T {
    return new HarnessClass(this._env)
  }

  protected async waitForReady(): Promise<void> {
    // The marker is an empty node, so "visible" means nothing; count it instead.
    const deadline = Date.now() + timeoutFor()
    while ((await this.self.count()) === 0) {
      if (Date.now() > deadline) {
        throw new Error(
          `harnessed: story ${this.#url} did not finish rendering. Either it threw ` +
            'while rendering (open it in Storybook to see why), or ' +
            '`.storybook/preview.ts` does not spread `harnessed()`.',
        )
      }
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    const playError = await this.self.attribute(PLAY_ERROR_ATTRIBUTE)
    if (playError !== null) {
      throw new Error(`harnessed: the play function of story ${this.#url} threw: ${playError}`)
    }
  }
}
