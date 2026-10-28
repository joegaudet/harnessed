<!--
  A counter rendered INSIDE a same-origin iframe (no `src` — the only kind jsdom
  can enter), beside a decoy with the same test id outside it. The framed content
  is its own component, mounted into the frame's body, as PortalDialog mounts its
  dialog into the page's.
-->
<script lang="ts">
  import { mount, onMount, unmount } from 'svelte'
  import Framed from './Framed.svelte'

  /**
   * Layout the boundingBox specs measure, as in the React fixture. The frame's
   * border and padding sit between its box and its document.
   */
  const FRAME = 'width: 240px; height: 120px; border: 3px solid; padding: 4px'
  const MARKER =
    'position: fixed; left: 12px; top: 34px; width: 56px; height: 78px; pointer-events: none'

  let frame: HTMLIFrameElement | undefined = $state()
  let body: HTMLElement | null = $state.raw(null)
  let hidden = $state(false)

  onMount(() => {
    body = frame?.contentDocument?.body ?? null
  })

  // Some engines replace the initial about:blank document when it loads.
  function loaded(event: Event) {
    body = (event.currentTarget as HTMLIFrameElement).contentDocument?.body ?? null
  }

  $effect(() => {
    if (body === null) return
    const framed = mount(Framed, { target: body })
    return () => {
      void unmount(framed)
    }
  })
</script>

<div data-testid="frame-host" data-test-frame-host="">
  <p data-testid="frame-count" data-test-frame-count="">decoy outside the frame</p>
  <p data-testid="frame-toast" data-test-frame-toast="">decoy toast outside the frame</p>
  <!-- Fixed, so its box is known in the viewport; it takes no clicks. -->
  <div data-testid="box" style={MARKER}></div>
  <button type="button" onclick={() => (hidden = true)}>Hide frame</button>
  <iframe
    bind:this={frame}
    data-testid="framed"
    data-test-framed=""
    title="Framed counter"
    style={hidden ? `${FRAME}; display: none` : FRAME}
    onload={loaded}
  ></iframe>
</div>
