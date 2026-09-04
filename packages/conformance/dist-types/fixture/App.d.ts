export declare const CARDS: ({
    label: string;
    hint: string;
} | {
    label: string;
    hint?: undefined;
})[];
/**
 * The Playwright side of the conformance suite drives the real app; `?view=` picks
 * which component is under test and the pathname picks the wizard step. Everything
 * renders inside one `stage` element, so route harnesses share a host selector.
 */
export declare function App(): import("react").JSX.Element;
//# sourceMappingURL=App.d.ts.map