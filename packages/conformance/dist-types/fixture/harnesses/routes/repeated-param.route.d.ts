import { RouteHarness } from '@harnessed/route';
/**
 * The same param twice, and a value that needs encoding. Proves replaceAll rather
 * than replace, and that values are URL-encoded.
 */
export declare class RepeatedParamRoute extends RouteHarness<{
    token: string;
}> {
    get path(): string;
    protected waitForReady(): Promise<void>;
}
//# sourceMappingURL=repeated-param.route.d.ts.map