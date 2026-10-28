/// <reference types="ember-source/types" />
import { renderComponent, renderSettled } from '@ember/renderer'
import { _backburner } from '@ember/runloop'
import { hasPendingWaiters } from '@ember/test-waiters'
import { timeoutFor } from '@harnessed-ts/core'
import {
  composeConfigs,
  composeStories as originalComposeStories,
  composeStory as originalComposeStory,
  setDefaultProjectAnnotations,
  setProjectAnnotations as originalSetProjectAnnotations,
} from 'storybook/preview-api'
import type {
  Args,
  ComponentAnnotations,
  ComposedStoryFn,
  NamedOrDefaultProjectAnnotations,
  NormalizedProjectAnnotations,
  ProjectAnnotations,
  RenderContext,
  Store_CSFExports,
  StoriesWithPartialProps,
  StoryAnnotations,
  StoryAnnotationsOrFn,
  StoryContext,
  WebRenderer,
} from 'storybook/internal/types'
import { harnessed as harnessedFor } from './index'

/**
 * Storybook's renderer type for Ember: a story's `component`, and what its
 * `render` returns, is a component — a Glimmer class or a `<template>`.
 */
export interface EmberRenderer extends WebRenderer {
  component: object
  storyResult: object
}

/** A CSF meta for an Ember component. */
export type Meta<TArgs = Args> = ComponentAnnotations<EmberRenderer, TArgs>

/** A CSF story for an Ember component. */
export type StoryObj<TArgs = Args> = StoryAnnotations<EmberRenderer, TArgs>

/** The `.storybook/preview.ts` default export. */
export type Preview = ProjectAnnotations<EmberRenderer>

/** What a story can set under `parameters.ember`. */
export interface EmberParameters {
  /**
   * The owner the story renders with, for components that inject services. A
   * function is called once per render. Without one, Ember's default applies:
   * an empty object, enough for components that look nothing up.
   */
  owner?: object | (() => object)
}

/**
 * Whether Ember has work in flight: a run loop, a scheduled timer, a render,
 * or a test waiter (an `@ember/test-waiters` waiter, as a data layer or
 * `ember-concurrency` registers). The same signals `settled()` in
 * `@ember/test-helpers` reads, without its test context.
 */
function busy(): boolean {
  return Boolean(_backburner.currentInstance) || _backburner.hasTimers() || hasPendingWaiters()
}

/**
 * Resolves once Ember is settled: rendering done, no run loop or timers left,
 * and no test waiter pending. Rejects if it is still busy after `timeout`.
 */
export async function settled(timeout = timeoutFor()): Promise<void> {
  const deadline = Date.now() + timeout
  for (;;) {
    await renderSettled()
    if (!busy()) return
    if (Date.now() > deadline) {
      throw new Error(
        `Ember did not settle within ${timeout}ms: a timer or test waiter is still pending`,
      )
    }
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

/**
 * `harnessed()` for Ember stories: every interaction a harness makes resolves
 * once Ember has settled, as it does under `@harnessed-ts/ember`, so the next
 * read sees the re-rendered canvas.
 *
 * ```ts
 * import { emberRenderer, harnessed } from '@harnessed-ts/storybook/ember'
 * export default { ...emberRenderer, ...harnessed() } satisfies Preview
 * ```
 */
export function harnessed(): ReturnType<typeof harnessedFor> {
  return harnessedFor({ afterAction: () => settled() })
}

/** What each canvas has on it, so the next render can tear it down first. */
const mounted = new WeakMap<HTMLElement, { destroy(): void }>()

function unmount(canvasElement: HTMLElement): void {
  mounted.get(canvasElement)?.destroy()
  mounted.delete(canvasElement)
}

function ownerFor(parameters: { ember?: EmberParameters }): object | undefined {
  const owner = parameters.ember?.owner
  return typeof owner === 'function' ? owner() : owner
}

/** The default `render`: the meta's `component`, with the story's args. */
export function render(_args: Args, context: StoryContext<EmberRenderer>): object {
  if (context.component === undefined) {
    throw new Error(
      `Unable to render story ${context.id}: the meta names no \`component\` and the story has no \`render\``,
    )
  }
  return context.component
}

/**
 * Renders the story's component into the canvas with Ember's public
 * `renderComponent`, passing the story's args. Every render starts fresh, so
 * changing an arg in the Controls panel remounts the component.
 */
export async function renderToCanvas(
  { storyContext, unboundStoryFn, showMain }: RenderContext<EmberRenderer>,
  canvasElement: HTMLElement,
): Promise<() => void> {
  const component = unboundStoryFn(storyContext)
  unmount(canvasElement)
  canvasElement.replaceChildren()
  const owner = ownerFor(storyContext.parameters)
  mounted.set(
    canvasElement,
    renderComponent(component, {
      into: canvasElement,
      args: { ...storyContext.args },
      ...(owner === undefined ? {} : { owner }),
    }),
  )
  await renderSettled()
  showMain()
  return () => unmount(canvasElement)
}

/** Storybook's `mount`: renders the story, and resolves with its canvas. */
export function mount(context: StoryContext<EmberRenderer>) {
  return async (): Promise<StoryContext<EmberRenderer>['canvas']> => {
    await context.renderToCanvas()
    return context.canvas
  }
}

/**
 * The renderer, as preview annotations. A Storybook built with a renderer
 * that is not Ember's — `@storybook/html-vite` — spreads these into
 * `.storybook/preview.ts`, and its stories render as Ember components.
 */
export const emberRenderer = {
  render,
  renderToCanvas,
  mount,
  parameters: { renderer: 'ember' },
} satisfies ProjectAnnotations<EmberRenderer>

const DEFAULT_ANNOTATIONS: ProjectAnnotations<EmberRenderer> = composeConfigs([emberRenderer])

/**
 * Portable stories: applies `.storybook/preview.ts` to every story composed
 * after it. Call once, in a Vitest setup file or at the top of a test.
 */
export function setProjectAnnotations(
  projectAnnotations:
    | NamedOrDefaultProjectAnnotations<EmberRenderer>
    | NamedOrDefaultProjectAnnotations<EmberRenderer>[],
): NormalizedProjectAnnotations<EmberRenderer> {
  setDefaultProjectAnnotations(DEFAULT_ANNOTATIONS)
  return originalSetProjectAnnotations(
    projectAnnotations,
  ) as NormalizedProjectAnnotations<EmberRenderer>
}

/** One story, composed with its meta and the project's annotations: `await story.run()` renders it. */
export function composeStory<TArgs extends Args = Args>(
  story: StoryAnnotationsOrFn<EmberRenderer, TArgs>,
  componentAnnotations: Meta<TArgs>,
  projectAnnotations?: ProjectAnnotations<EmberRenderer>,
  exportsName?: string,
): ComposedStoryFn<EmberRenderer, Partial<TArgs>> {
  return originalComposeStory(
    // Storybook's own signature takes untyped args; the typed ones are a subtype.
    story as StoryAnnotationsOrFn<EmberRenderer>,
    componentAnnotations as Meta,
    projectAnnotations,
    (globalThis as { globalProjectAnnotations?: ProjectAnnotations<EmberRenderer> })
      .globalProjectAnnotations ?? DEFAULT_ANNOTATIONS,
    exportsName,
  ) as ComposedStoryFn<EmberRenderer, Partial<TArgs>>
}

/** Every story in a CSF module, composed: `const stories = composeStories(LoginStories)`. */
// `any` args, as in Storybook's own renderers: a module whose stories take typed
// args is not assignable to one whose stories take `Args`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function composeStories<TModule extends Store_CSFExports<EmberRenderer, any>>(
  csfExports: TModule,
  projectAnnotations?: ProjectAnnotations<EmberRenderer>,
): Omit<StoriesWithPartialProps<EmberRenderer, TModule>, keyof Store_CSFExports> {
  // Storybook passes it through to `composeStory`, where `undefined` is allowed.
  const project = projectAnnotations as ProjectAnnotations<EmberRenderer>
  return originalComposeStories(csfExports, project, composeStory) as Omit<
    StoriesWithPartialProps<EmberRenderer, TModule>,
    keyof Store_CSFExports
  >
}
