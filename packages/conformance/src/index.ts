/**
 * The driver certification suite.
 *
 * A driver for `@harnessed-ts/core` is not "done" when it compiles — it is done when
 * it agrees with every other driver about what the shared API means. These are the
 * specs that decide that, exported so a driver living outside this repo can run
 * exactly the same ones.
 *
 * Wire them into whatever runner your driver needs; `runners/` in this package's
 * source holds the two reference implementations (Vitest + jsdom, and Playwright).
 *
 * ```ts
 * import { specs } from '@harnessed-ts/conformance'
 * import { App } from '@harnessed-ts/conformance/fixture'
 *
 * for (const spec of specs) {
 *   it(spec.name, () => spec.run({ show: view => mountAndBuildEnv(view) }))
 * }
 * ```
 */
export { specs } from '../specs/catalog'
export type { ConformanceCtx, Spec, View } from '../specs/catalog'
export { pageSpecs, urlSpecs } from '../specs/pages.catalog'
export type { PageSpec, UrlCtx, UrlSpec } from '../specs/pages.catalog'
export { viewSearch } from '../specs/views'

// The harnesses the specs drive. A driver author needs these to understand what
// the specs are asking for, and may reuse them directly.
export { CardGridHarness, CardHarness } from '../fixture/harnesses/CardGrid.harness'
export {
  CounterHarness,
  FrameHarness,
  FramedPanelHarness,
} from '../fixture/harnesses/FramedPanel.harness'
export { LoginFormHarness } from '../fixture/harnesses/LoginForm.harness'
export type { Credentials } from '../fixture/harnesses/LoginForm.harness'
export { PortalDialogHarness } from '../fixture/harnesses/PortalDialog.harness'
export { CardsPage } from '../fixture/harnesses/pages/cards.page'
export { DialogPage } from '../fixture/harnesses/pages/dialog.page'
export { CounterPage, FramePage } from '../fixture/harnesses/pages/frame.page'
export { LoginPage } from '../fixture/harnesses/pages/login.page'
export { NeverReadyPage } from '../fixture/harnesses/pages/never-ready.page'
export { RepeatedParamPage } from '../fixture/harnesses/pages/repeated-param.page'
export {
  StepOnePage,
  StepTwoPage,
  WizardStepPage,
} from '../fixture/harnesses/pages/wizard-step.page'
export { WizardPage } from '../fixture/harnesses/pages/wizard.page'
