import { ComponentHarness } from '@harnessed/core';
/** The host is itself the button, so `choose()` acts on `self`. */
export declare class CardHarness extends ComponentHarness {
    private accessor labelLine;
    private accessor hintLine;
    label(): Promise<string>;
    hint(): Promise<string | null>;
    isChosen(): Promise<boolean>;
    choose(): Promise<void>;
}
export declare class CardGridHarness extends ComponentHarness {
    private accessor topTitle;
    private accessor title;
    private accessor card;
    /** There is an h1 AND an h2 here, so `level` has to do real work. */
    topHeading(): Promise<string>;
    heading(): Promise<string>;
    cardCount(): Promise<number>;
    labels(): Promise<string[]>;
    chooseByLabel(label: string): Promise<void>;
    chosenLabel(): Promise<string | null>;
    labelAt(index: number): Promise<string>;
    firstLabel(): Promise<string>;
    lastLabel(): Promise<string>;
    visitedLabels(): Promise<string[]>;
    /** A selector computed at call time keeps the harness scope via elementBy. */
    labelTextAt(index: number): Promise<string>;
    /** One card by position, resolved lazily — for matchers that take a harness. */
    cardAt(index: number): CardHarness;
    hintCount(): Promise<number>;
    /**
     * Three cards match, and this asks a single-target question. Strict resolution
     * must reject rather than silently pick the first.
     */
    ambiguousCardText(): Promise<string>;
}
//# sourceMappingURL=CardGrid.harness.d.ts.map