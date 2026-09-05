import { withWorld } from '@harnessed-ts/playwright/bdd'
import { pw } from '@harnessed-ts/playwright'
import { expect, test as base } from '@playwright/test'
import { StepOneRoute } from '../fixture/harnesses/routes/step-one.route'

/**
 * `withWorld` had no coverage at all, and two things about it are easy to get
 * wrong in ways that only show up at runtime: Playwright reads a fixture's
 * destructured parameter names to work out its dependencies and rejects a plain
 * parameter, and the returned type has to keep the base's own fixtures or `world`
 * is invisible to every step that destructures it.
 */
interface World {
  stepOne: StepOneRoute
  note: string
}

const test = withWorld<World, typeof base>(base)

test('the world fixture is available and starts empty', async ({ world }) => {
  expect(world).toEqual({})
})

test('the world carries a route harness across steps within a scenario', async ({
  page,
  world,
}) => {
  world.stepOne = new StepOneRoute(pw(page))
  await world.stepOne.goto()
  expect(await world.stepOne!.stepOne.heading()).toBe('Step one')
})

test('each test gets its own world, so nothing leaks between them', async ({ world }) => {
  // Would hold a value from the test above if the fixture were shared.
  expect(world.stepOne).toBeUndefined()
  expect(world.note).toBeUndefined()
})

test('the base test keeps its own fixtures', async ({ page, world }) => {
  expect(page).toBeTruthy()
  expect(world).toBeTruthy()
})
