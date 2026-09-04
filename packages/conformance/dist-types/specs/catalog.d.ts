import type { EnvConfig } from '@harnessed/core';
export type View = 'login' | 'login-error' | 'cards' | 'dialog' | 'wizard';
export type DriverId = 'dom' | 'playwright';
export interface ConformanceCtx {
    readonly driver: DriverId;
    /** Puts the named view on screen and returns the env a harness is constructed with. */
    show(view: View): Promise<EnvConfig>;
}
export interface Spec {
    name: string;
    /** Which drivers this spec runs under. Defaults to every driver. */
    drivers?: DriverId[];
    run(ctx: ConformanceCtx): Promise<void>;
}
/**
 * The parity suite. Every spec here is written once and executed by every driver.
 * A driver that disagrees with another fails the build — that agreement is the
 * whole reason the abstraction exists.
 */
export declare const specs: Spec[];
//# sourceMappingURL=catalog.d.ts.map