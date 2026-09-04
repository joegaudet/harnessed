import { ComponentHarness } from '@harnessed/core';
/** The dialog is portalled to document.body, outside this host's subtree. */
export declare class PortalDialogHarness extends ComponentHarness {
    private accessor opener;
    private accessor dialog;
    private accessor body;
    /** Deliberately NOT global — must never find the portalled node. */
    private accessor scopedBody;
    open(): Promise<void>;
    isOpen(): Promise<boolean>;
    bodyText(): Promise<string>;
    scopedBodyCount(): Promise<number>;
}
//# sourceMappingURL=PortalDialog.harness.d.ts.map