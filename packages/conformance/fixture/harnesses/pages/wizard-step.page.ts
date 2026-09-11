import { ByRole, ByTestId, Harness, testId } from '@harnessed-ts/core'
import type { Query } from '@harnessed-ts/core'
import { PageHarness } from '@harnessed-ts/page'

/**
 * Shared shape for both wizard steps: a level-1 title and a readiness check. The
 * base carries the decorated fields; each subclass supplies only its own host,
 * which is the inheritance case @Harness has to survive — now on a page.
 */
export abstract class WizardStepPage<
  Params extends Record<string, string> = Record<never, never>,
> extends PageHarness<Params> {
  @ByRole('heading', { level: 1 }) private accessor title!: Query

  async heading(): Promise<string> {
    return this.title.text()
  }

  protected async waitForReady(): Promise<void> {
    await this.self.waitFor('visible')
  }
}

/** Reached by interaction only: no `path`, so `goto()` is a readable refusal. */
@Harness({ host: testId('page-step-one') })
export class StepOnePage extends WizardStepPage {
  @ByRole('button', { name: 'Continue' }) private accessor continueBtn!: Query

  /** The action leads to step two, so the method hands back that page. */
  async continue(): Promise<StepTwoPage> {
    await this.continueBtn.click()
    return this.transitionTo(StepTwoPage)
  }
}

/**
 * `/step-two?token=$token` — substitution happens in the query string, and the
 * param is declared so goto() is checked against it.
 */
@Harness({ host: testId('page-step-two') })
export class StepTwoPage extends WizardStepPage<{ token: string }> {
  override get path(): string {
    return '/step-two?token=$token'
  }

  @ByTestId('step-two-token') private accessor tokenLine!: Query
  @ByTestId('step-two-expired') private accessor expiredNote!: Query

  async token(): Promise<string | null> {
    if (await this.tokenLine.isAbsent()) return null
    return this.tokenLine.text()
  }

  async showsExpiredNotice(): Promise<boolean> {
    return (await this.expiredNote.count()) > 0
  }
}
