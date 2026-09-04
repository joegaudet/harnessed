import { RouteHarness } from '@harnessed/route';
import { StepOneHarness, StepTwoHarness } from '../Wizard.harness';
/** `/` — takes no params, so goto() must be callable with no argument. */
export declare class StepOneRoute extends RouteHarness {
    get path(): string;
    accessor stepOne: StepOneHarness;
    accessor stepTwo: StepTwoHarness;
    protected waitForReady(): Promise<void>;
}
//# sourceMappingURL=step-one.route.d.ts.map