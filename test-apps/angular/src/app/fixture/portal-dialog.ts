import { DOCUMENT } from '@angular/common'
import { Component, inject, viewChild, ViewContainerRef } from '@angular/core'
import type { EmbeddedViewRef, OnDestroy, TemplateRef } from '@angular/core'

/**
 * The dialog renders OUTSIDE the host subtree, so a scoped query cannot reach it.
 * This is what `{ global: true }` exists for.
 *
 * Portalled the way the CDK's `DomPortalOutlet` does it, without the CDK: the
 * template becomes an embedded view in this component's container — so change
 * detection and destruction stay Angular's — and its root nodes move to
 * `document.body`, where the React fixture's `createPortal` puts them.
 */
@Component({
  selector: 'div[fixturePortalDialog]',
  host: { 'data-testid': 'portal-host', 'data-test-portal-host': '' },
  template: `
    <button type="button" (click)="show()">Open confirm</button>
    <ng-template #dialog>
      <div role="dialog" aria-label="Confirm">
        <p data-testid="dialog-body" data-test-dialog-body="">Are you sure?</p>
        <button type="button" (click)="dismiss()">Dismiss</button>
      </div>
    </ng-template>
  `,
})
export class PortalDialog implements OnDestroy {
  private readonly dialog = viewChild.required<TemplateRef<unknown>>('dialog')
  private readonly container = inject(ViewContainerRef)
  private readonly body = inject(DOCUMENT).body
  private open: EmbeddedViewRef<unknown> | undefined

  protected show(): void {
    if (this.open !== undefined) return
    this.open = this.container.createEmbeddedView(this.dialog())
    for (const node of this.open.rootNodes as Node[]) this.body.appendChild(node)
  }

  protected dismiss(): void {
    // Destroying the view removes its nodes from wherever they now are.
    this.open?.destroy()
    this.open = undefined
  }

  ngOnDestroy(): void {
    this.dismiss()
  }
}
