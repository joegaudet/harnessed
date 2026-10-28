import {
  afterNextRender,
  Component,
  computed,
  inject,
  signal,
  viewChild,
  ViewContainerRef,
} from '@angular/core'
import type { ElementRef, EmbeddedViewRef, TemplateRef } from '@angular/core'

/**
 * Layout the boundingBox specs measure, as in the React fixture. The frame's
 * border and padding sit between its box and its document.
 */
const FRAME = 'width: 240px; height: 120px; border: 3px solid; padding: 4px'
const MARKER =
  'position: fixed; left: 12px; top: 34px; width: 56px; height: 78px; pointer-events: none'
const FRAMED_MARKER =
  'position: fixed; left: 5px; top: 6px; width: 20px; height: 10px; pointer-events: none'

/**
 * A counter rendered INSIDE a same-origin iframe (no `src` — the only kind jsdom
 * can enter), beside a decoy with the same test id outside it.
 *
 * The framed content is an embedded view of this component, its root nodes
 * moved into the frame's body: Angular keeps updating them there, as React's
 * `createPortal` into that body does.
 */
@Component({
  selector: 'div[fixtureFramedPanel]',
  host: { 'data-testid': 'frame-host', 'data-test-frame-host': '' },
  template: `
    <p data-testid="frame-count" data-test-frame-count="">decoy outside the frame</p>
    <p data-testid="frame-toast" data-test-frame-toast="">decoy toast outside the frame</p>
    <!-- Fixed, so its box is known in the viewport; it takes no clicks. -->
    <div data-testid="box" [style]="marker"></div>
    <button type="button" (click)="hidden.set(true)">Hide frame</button>
    <iframe
      #frame
      data-testid="framed"
      data-test-framed=""
      title="Framed counter"
      [style]="frameStyle()"
      (load)="moveInto(frameBody())"
    ></iframe>
    <ng-template #framed>
      <div data-testid="counter" data-test-counter="">
        <p data-testid="frame-count" data-test-frame-count="">Clicked {{ count() }} times</p>
        <button type="button" (click)="count.set(count() + 1)">Add one</button>
        <label>Note <input /></label>
      </div>
      <p data-testid="frame-toast" data-test-frame-toast="">Toast inside the frame</p>
      <div data-testid="framed-box" [style]="framedMarker"></div>
    </ng-template>
  `,
})
export class FramedPanel {
  protected readonly marker = MARKER
  protected readonly framedMarker = FRAMED_MARKER
  protected readonly count = signal(0)
  protected readonly hidden = signal(false)
  protected readonly frameStyle = computed(() =>
    this.hidden() ? `${FRAME}; display: none` : FRAME,
  )

  private readonly frame = viewChild.required<ElementRef<HTMLIFrameElement>>('frame')
  private readonly framed = viewChild.required<TemplateRef<unknown>>('framed')
  private readonly container = inject(ViewContainerRef)
  private view: EmbeddedViewRef<unknown> | undefined

  constructor() {
    // Once the iframe is in the document, its (about:blank) body exists. This
    // runs inside the render that put it there, so whenStable() — and the
    // render a test awaits — already includes the framed content.
    afterNextRender({
      write: () => {
        this.view = this.container.createEmbeddedView(this.framed())
        this.moveInto(this.frameBody())
        this.view.detectChanges()
      },
    })
  }

  protected frameBody(): HTMLElement | null {
    return this.frame().nativeElement.contentDocument?.body ?? null
  }

  /** Some engines replace the initial about:blank document when it loads. */
  protected moveInto(body: HTMLElement | null): void {
    if (this.view === undefined || body === null) return
    for (const node of this.view.rootNodes as Node[]) {
      if (node.parentNode !== body) body.appendChild(node)
    }
  }
}
