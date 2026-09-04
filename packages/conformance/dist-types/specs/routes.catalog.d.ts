import type { Page } from '@playwright/test';
export interface RouteCtx {
    readonly page: Page;
}
export interface RouteSpec {
    name: string;
    run(ctx: RouteCtx): Promise<void>;
}
/** Route behaviour is a URL, a navigation, and a readiness check. Playwright only. */
export declare const routeSpecs: RouteSpec[];
//# sourceMappingURL=routes.catalog.d.ts.map