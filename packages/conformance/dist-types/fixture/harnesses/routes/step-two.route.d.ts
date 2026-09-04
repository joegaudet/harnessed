import { RouteHarness } from '@harnessed/route';
import { StepTwoHarness } from '../Wizard.harness';
/**
 * `/step-two?token=$token` — substitution happens in the query string, and the
 * param is declared so goto() is checked against it.
 */
export declare class StepTwoRoute extends RouteHarness<{
    token: string;
}> {
    get path(): string;
    accessor stepTwo: StepTwoHarness;
    protected waitForReady(): Promise<void>;
}
//# sourceMappingURL=step-two.route.d.ts.map