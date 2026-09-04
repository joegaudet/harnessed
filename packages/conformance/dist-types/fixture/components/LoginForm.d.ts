export type LoginStatus = 'idle' | 'submitting' | 'done';
export interface LoginFormProps {
    onSubmit?: (email: string, password: string) => void;
    /** Renders the error line when set. Absent otherwise — exercises count()/isAbsent(). */
    error?: string;
}
/**
 * Labels, inputs, a placeholder, a submit button, a conditionally rendered error,
 * and a control whose accessible name changes with its state (which is why the
 * status carries a data attribute instead).
 */
export declare function LoginForm({ onSubmit, error }: LoginFormProps): import("react").JSX.Element;
//# sourceMappingURL=LoginForm.d.ts.map