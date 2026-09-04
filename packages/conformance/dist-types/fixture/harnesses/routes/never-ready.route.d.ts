import { RouteHarness } from '@harnessed/route';
/** Waits for something the fixture never renders. Proves goto() awaits waitForReady. */
export declare class NeverReadyRoute extends RouteHarness {
    get path(): string;
    protected waitForReady(): Promise<void>;
}
//# sourceMappingURL=never-ready.route.d.ts.map