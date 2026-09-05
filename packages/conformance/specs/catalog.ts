import assert from 'node:assert/strict'
import type { EnvConfig } from '@harnessed/core'
import { CardGridHarness } from '../fixture/harnesses/CardGrid.harness'
import { LoginFormHarness } from '../fixture/harnesses/LoginForm.harness'
import { PortalDialogHarness } from '../fixture/harnesses/PortalDialog.harness'
import { StepOneHarness, StepTwoHarness } from '../fixture/harnesses/Wizard.harness'

export type View = 'login' | 'login-error' | 'login-late-duplicates' | 'cards' | 'dialog' | 'wizard'
export interface ConformanceCtx {
  /** Puts the named view on screen and returns the env a harness is constructed with. */
  show(view: View): Promise<EnvConfig>
}

/**
 * Every spec runs under every driver. There is deliberately no per-driver opt-out:
 * the moment one exists, "both drivers agree" stops meaning what it says. The two
 * things that genuinely cannot be shared — route behaviour, which needs a real
 * page, and matcher registration, which is runner-specific — live in their own
 * files rather than as exceptions here.
 */
export interface Spec {
  name: string
  run(ctx: ConformanceCtx): Promise<void>
}

/** How long "immediately" is allowed to take. A driver that waits out a retry
 *  timeout instead of answering blows straight through this. */
const IMMEDIATE_MS = 400

/**
 * The parity suite. Every spec here is written once and executed by every driver.
 * A driver that disagrees with another fails the build — that agreement is the
 * whole reason the abstraction exists.
 */
export const specs: Spec[] = [
  // ---------------------------------------------------------------- guarantee 1
  {
    name: 'guarantee 1: count() on an absent target returns 0 without waiting',
    async run(ctx) {
      const form = new LoginFormHarness(await ctx.show('login'))
      const started = Date.now()
      assert.equal(await form.errorCount(), 0)
      const elapsed = Date.now() - started
      assert.ok(
        elapsed < IMMEDIATE_MS,
        `count() on an absent target took ${elapsed}ms; it must answer immediately`,
      )
    },
  },
  {
    name: 'guarantee 1: isAbsent() is true for an absent target, and does not throw',
    async run(ctx) {
      const form = new LoginFormHarness(await ctx.show('login'))
      const started = Date.now()
      assert.equal(await form.errorText(), null)
      const elapsed = Date.now() - started
      assert.ok(elapsed < IMMEDIATE_MS, `isAbsent() took ${elapsed}ms`)
    },
  },
  {
    name: 'guarantee 1: a present conditional target is found and read',
    async run(ctx) {
      const form = new LoginFormHarness(await ctx.show('login-error'))
      assert.equal(await form.errorCount(), 1)
      assert.equal(await form.errorText(), 'Bad credentials')
    },
  },

  // ---------------------------------------------------------------- guarantee 2
  {
    name: 'guarantee 2: a single-target operation rejects when several nodes match',
    async run(ctx) {
      const grid = new CardGridHarness(await ctx.show('cards'))
      assert.equal(await grid.cardCount(), 3)
      await assert.rejects(
        () => grid.ambiguousCardText(),
        'a single-target read matching 3 nodes must reject, not pick one',
      )
    },
  },

  // ---------------------------------------------------------------- guarantee 3
  {
    name: 'guarantee 3: role selectors discriminate on level',
    async run(ctx) {
      const grid = new CardGridHarness(await ctx.show('cards'))
      assert.equal(await grid.topHeading(), 'Options')
      assert.equal(await grid.heading(), 'Pick one')
    },
  },

  // ---------------------------------------------------------------- guarantee 4
  {
    name: 'guarantee 4: elementBy keeps the harness scope',
    async run(ctx) {
      const grid = new CardGridHarness(await ctx.show('cards'))
      // Two hints inside the grid; a third node with the same test id sits outside it.
      assert.equal(await grid.hintCount(), 2)
    },
  },
  {
    name: 'guarantee 4: elementBy honours nth within the scope',
    async run(ctx) {
      const grid = new CardGridHarness(await ctx.show('cards'))
      assert.equal(await grid.labelTextAt(0), 'Small')
      assert.equal(await grid.labelTextAt(1), 'Medium')
      assert.equal(await grid.labelTextAt(2), 'Large')
    },
  },

  // ---------------------------------------------------------------- guarantee 5
  {
    name: 'guarantee 5: global escapes the host scope, scoped queries do not',
    async run(ctx) {
      const dialog = new PortalDialogHarness(await ctx.show('dialog'))
      assert.equal(await dialog.isOpen(), false)
      await dialog.open()
      assert.equal(await dialog.isOpen(), true)
      assert.equal(await dialog.bodyText(), 'Are you sure?')
      // Same test id, reached only because the field is global.
      assert.equal(await dialog.scopedBodyCount(), 0)
    },
  },
  {
    name: 'a global field finds nothing when the global node is absent',
    async run(ctx) {
      const form = new LoginFormHarness(await ctx.show('login'))
      assert.equal(await form.seesGlobalDialog(), false)
    },
  },

  // ------------------------------------------------------------------- querying
  {
    name: 'queries by label, test id, role, and placeholder all reach the same input',
    async run(ctx) {
      const form = new LoginFormHarness(await ctx.show('login'))
      await form.fillIn({ email: 'ada@example.com' })
      assert.equal(await form.emailViaPlaceholder(), 'ada@example.com')
    },
  },
  {
    name: 'heading text is read through a level-scoped role query',
    async run(ctx) {
      const form = new LoginFormHarness(await ctx.show('login'))
      assert.equal(await form.heading(), 'Sign in')
    },
  },
  {
    name: 'isVisible is true for a rendered node',
    async run(ctx) {
      const form = new LoginFormHarness(await ctx.show('login'))
      assert.equal(await form.titleIsVisible(), true)
    },
  },

  // --------------------------------------------------------------- interactions
  {
    name: 'fill then inputValue round-trips both fields',
    async run(ctx) {
      const form = new LoginFormHarness(await ctx.show('login'))
      await form.fillIn({ email: 'grace@example.com', password: 'hopper' })
      assert.deepEqual(await form.values(), {
        email: 'grace@example.com',
        password: 'hopper',
      })
    },
  },
  {
    name: 'fill with an empty string clears without typing',
    async run(ctx) {
      const form = new LoginFormHarness(await ctx.show('login'))
      await form.fillIn({ email: 'ada@example.com' })
      await form.fillIn({ email: '' })
      assert.equal((await form.values()).email, '')
    },
  },
  {
    name: 'clear() empties an input',
    async run(ctx) {
      const form = new LoginFormHarness(await ctx.show('login'))
      await form.fillIn({ email: 'ada@example.com' })
      await form.clearEmail()
      assert.equal((await form.values()).email, '')
    },
  },
  {
    name: 'isEnabled reflects a disabled attribute',
    async run(ctx) {
      const form = new LoginFormHarness(await ctx.show('login'))
      assert.equal(await form.isSubmitEnabled(), false)
      await form.fillIn({ email: 'ada@example.com' })
      assert.equal(await form.isSubmitEnabled(), true)
    },
  },
  {
    name: 'check, uncheck, and isChecked drive a checkbox',
    async run(ctx) {
      const form = new LoginFormHarness(await ctx.show('login'))
      assert.equal(await form.isRemembered(), false)
      await form.rememberMe()
      assert.equal(await form.isRemembered(), true)
      await form.forgetMe()
      assert.equal(await form.isRemembered(), false)
    },
  },
  {
    name: 'selectOption picks a value from a select',
    async run(ctx) {
      const form = new LoginFormHarness(await ctx.show('login'))
      assert.equal(await form.chosenPlan(), 'free')
      await form.choosePlan('pro')
      assert.equal(await form.chosenPlan(), 'pro')
    },
  },
  {
    name: 'attribute() reads a data attribute that tracks state',
    async run(ctx) {
      const form = new LoginFormHarness(await ctx.show('login'))
      assert.equal(await form.status(), 'idle')
      await form.fillIn({ email: 'ada@example.com' })
      await form.submitIt()
      assert.equal(await form.status(), 'done')
    },
  },
  {
    name: 'attribute() returns null for an attribute that is not set',
    async run(ctx) {
      const grid = new CardGridHarness(await ctx.show('cards'))
      assert.equal(await grid.chosenLabel(), null)
    },
  },
  {
    name: 'hover, focus, and press are available on a target',
    async run(ctx) {
      const form = new LoginFormHarness(await ctx.show('login'))
      await form.hoverSubmit()
      await form.focusEmail()
      await form.pressInEmail('a')
      assert.equal((await form.values()).email, 'a')
    },
  },

  // --------------------------------------------------------- multiple instances
  {
    name: 'count, nth, first, and last address repeated instances',
    async run(ctx) {
      const grid = new CardGridHarness(await ctx.show('cards'))
      assert.equal(await grid.cardCount(), 3)
      assert.equal(await grid.labelAt(1), 'Medium')
      assert.equal(await grid.firstLabel(), 'Small')
      assert.equal(await grid.lastLabel(), 'Large')
    },
  },
  {
    name: 'map collects across every instance in order',
    async run(ctx) {
      const grid = new CardGridHarness(await ctx.show('cards'))
      assert.deepEqual(await grid.labels(), ['Small', 'Medium', 'Large'])
    },
  },
  {
    name: 'each visits every instance in order',
    async run(ctx) {
      const grid = new CardGridHarness(await ctx.show('cards'))
      assert.deepEqual(await grid.visitedLabels(), ['Small', 'Medium', 'Large'])
    },
  },
  {
    name: 'filter narrows instances by a behavioural predicate',
    async run(ctx) {
      const grid = new CardGridHarness(await ctx.show('cards'))
      await grid.chooseByLabel('Medium')
      assert.equal(await grid.chosenLabel(), 'Medium')
    },
  },
  {
    name: 'a child harness inherits the scope chain and reads its own subtree',
    async run(ctx) {
      const grid = new CardGridHarness(await ctx.show('cards'))
      // 'Large' carries no hint, and a decoy with the same test id sits outside
      // the grid — so a child harness reading the page instead of its own subtree
      // would report the decoy's text here.
      assert.deepEqual(await grid.hints(), ['Under 1000 sq ft', '1000 to 2500 sq ft', null])
    },
  },
  {
    name: 'list callbacks that mutate the page keep working',
    async run(ctx) {
      const grid = new CardGridHarness(await ctx.show('cards'))
      // Choosing re-renders the grid mid-iteration. A driver that resolves the
      // list once must survive its nodes being replaced under it, not act on
      // detached elements or lose its place.
      const seen: string[] = []
      await grid.chooseEachInTurn(seen)
      assert.deepEqual(seen, ['Small', 'Medium', 'Large'])
      assert.equal(await grid.chosenLabel(), 'Large')
    },
  },
  {
    name: 'a resolved list is not fooled by nodes replaced mid-iteration',
    async run(ctx) {
      const grid = new CardGridHarness(await ctx.show('cards'))
      // Choosing re-keys the card, so the clicked node is detached before the
      // read. A driver holding resolved nodes must notice and re-resolve — a
      // detached node still answers getAttribute, with the stale value.
      assert.deepEqual(await grid.pressedStatesAfterChoosingEach(), ['true', 'true', 'true'])
    },
  },
  {
    name: 'selection state is read from aria-pressed, not a class',
    async run(ctx) {
      const grid = new CardGridHarness(await ctx.show('cards'))
      assert.equal(await grid.chosenLabel(), null)
      await grid.chooseByLabel('Large')
      assert.equal(await grid.chosenLabel(), 'Large')
    },
  },

  // -------------------------------------------------------------- @Harness meta
  {
    name: '@Harness on a subclass supplies the host for an undecorated abstract base',
    async run(ctx) {
      const env = await ctx.show('wizard')
      const stepOne = new StepOneHarness(env)
      // heading() is declared on the abstract base; the host comes from the subclass.
      assert.equal(await stepOne.heading(), 'Step one')
    },
  },
  {
    name: 'two subclasses of one abstract base resolve to different hosts',
    async run(ctx) {
      const env = await ctx.show('wizard')
      const stepOne = new StepOneHarness(env)
      const stepTwo = new StepTwoHarness(env)
      assert.equal(await stepOne.heading(), 'Step one')
      assert.equal(await stepTwo.isAbsent(), true)
      await stepOne.continue()
      assert.equal(await stepTwo.heading(), 'Step two')
      assert.equal(await stepOne.isAbsent(), true)
    },
  },
  // ------------------------------------------- divergences the drivers once had
  {
    name: 'isEnabled reports a control disabled by an ancestor fieldset',
    async run(ctx) {
      const form = new LoginFormHarness(await ctx.show('login'))
      // The control has no `disabled` attribute of its own — it inherits one.
      // Reading the attribute alone made this true under dom and false under
      // Playwright.
      assert.equal(await form.isReferralEnabled(), false)
    },
  },
  {
    name: 'last() on an empty set fails the same way under every driver',
    async run(ctx) {
      const form = new LoginFormHarness(await ctx.show('login'))
      const started = Date.now()
      await assert.rejects(() => form.lastMissing(), /no nodes match/)
      const elapsed = Date.now() - started
      // Playwright reads nth(-1) as "the last one" and would wait out the whole
      // timeout; dom reported a confusing negative index.
      assert.ok(elapsed < IMMEDIATE_MS, `last() on an empty set took ${elapsed}ms`)
    },
  },
  {
    name: 'a strict violation is raised for duplicates that only appear later',
    async run(ctx) {
      const form = new LoginFormHarness(await ctx.show('login-late-duplicates'))
      // Nothing matches yet, so a check that only looks once sees no ambiguity.
      assert.equal(await form.lateCount(), 0)
      await assert.rejects(() => form.lateText(), /strict mode violation/)
    },
  },
  {
    name: 'a strict violation names the scope chain, not just the leaf',
    async run(ctx) {
      const grid = new CardGridHarness(await ctx.show('cards'))
      await assert.rejects(() => grid.ambiguousCardText(), /card-grid.*card/s)
    },
  },

  // ------------------------------------------------- members without coverage
  {
    name: 'selectedOptions reads every selected value of a multi-select',
    async run(ctx) {
      const form = new LoginFormHarness(await ctx.show('login'))
      assert.deepEqual(await form.addonValues(), ['sms'])
      await form.chooseAddons(['voice', 'fax'])
      assert.deepEqual(await form.addonValues(), ['voice', 'fax'])
    },
  },
  {
    name: 'texts reads every match, trimmed and in order',
    async run(ctx) {
      const form = new LoginFormHarness(await ctx.show('login-late-duplicates'))
      await form.waitForLate()
      assert.deepEqual(await form.lateTexts(), ['first', 'second'])
    },
  },
  {
    name: 'waitFor resolves once a late node is visible',
    async run(ctx) {
      const form = new LoginFormHarness(await ctx.show('login-late-duplicates'))
      assert.equal(await form.lateCount(), 0)
      await form.waitForLate()
      assert.equal(await form.lateCount(), 2)
    },
  },
  {
    name: 'blur is available and leaves the field readable',
    async run(ctx) {
      const form = new LoginFormHarness(await ctx.show('login'))
      await form.fillIn({ email: 'ada@example.com' })
      await form.blurEmail()
      assert.equal((await form.values()).email, 'ada@example.com')
    },
  },
]
