import { ComponentHarness } from '@harnessed/core';
/**
 * Shared shape for both wizard steps: a level-1 title and nothing else in common.
 * The base carries the decorated fields; each subclass supplies only its own host,
 * which is the inheritance case @Harness has to survive.
 */
export declare abstract class WizardStepHarness extends ComponentHarness {
    private accessor title;
    heading(): Promise<string>;
}
export declare class StepOneHarness extends WizardStepHarness {
    private accessor continueBtn;
    continue(): Promise<void>;
}
export declare class StepTwoHarness extends WizardStepHarness {
    private accessor tokenLine;
    private accessor expiredNote;
    token(): Promise<string | null>;
    showsExpiredNotice(): Promise<boolean>;
}
//# sourceMappingURL=Wizard.harness.d.ts.map