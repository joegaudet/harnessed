export interface CardSpec {
    label: string;
    hint?: string;
}
export interface CardProps extends CardSpec {
    on: boolean;
    onChoose: () => void;
}
/** The host IS the interactive element — exercises `self`. Selection is aria-pressed. */
export declare function Card({ label, hint, on, onChoose }: CardProps): import("react").JSX.Element;
/** Several instances of one component on one screen — exercises count/nth/map/filter. */
export declare function CardGrid({ cards }: {
    cards: CardSpec[];
}): import("react").JSX.Element;
//# sourceMappingURL=CardGrid.d.ts.map