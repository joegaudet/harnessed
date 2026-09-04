import { ComponentHarness } from '@harnessed/core';
import type { Query } from '@harnessed/core';
export interface Credentials {
    email?: string;
    password?: string;
}
/**
 * A form: labels, a placeholder, a checkbox, a select, a conditionally rendered
 * error, and a submit button whose accessible name changes with its state (so the
 * harness reads `data-status` rather than querying by the name it is asserting).
 */
export declare class LoginFormHarness extends ComponentHarness {
    private accessor title;
    private accessor email;
    private accessor password;
    private accessor remember;
    private accessor plan;
    private accessor emailByPlaceholder;
    private accessor submit;
    private accessor errorLine;
    private accessor globalDialog;
    heading(): Promise<string>;
    fillIn(credentials: Credentials): Promise<void>;
    values(): Promise<Required<Credentials>>;
    emailViaPlaceholder(): Promise<string>;
    submitIt(): Promise<void>;
    isSubmitEnabled(): Promise<boolean>;
    status(): Promise<string | null>;
    rememberMe(): Promise<void>;
    forgetMe(): Promise<void>;
    isRemembered(): Promise<boolean>;
    choosePlan(value: string): Promise<void>;
    chosenPlan(): Promise<string>;
    /** Absent unless the fixture was given an error — the count()/isAbsent() case. */
    errorText(): Promise<string | null>;
    errorCount(): Promise<number>;
    /** Exposed for the matcher specs, which assert against a target directly. */
    get errorQuery(): Query;
    /** Reaches a node the host scope cannot see; used to prove `global` escapes scope. */
    seesGlobalDialog(): Promise<boolean>;
    clearEmail(): Promise<void>;
    focusEmail(): Promise<void>;
    pressInEmail(key: string): Promise<void>;
    hoverSubmit(): Promise<void>;
    titleIsVisible(): Promise<boolean>;
}
//# sourceMappingURL=LoginForm.harness.d.ts.map