<!-- What FramedPanel mounts into the frame's body. -->
<script lang="ts">
  const FRAMED_MARKER =
    'position: fixed; left: 5px; top: 6px; width: 20px; height: 10px; pointer-events: none'

  let count = $state(0)
</script>

<div data-testid="counter" data-test-counter="">
  <p data-testid="frame-count" data-test-frame-count="">Clicked {count} times</p>
  <button type="button" onclick={() => (count += 1)}>Add one</button>
  <label>Note <input /></label>
</div>
<p data-testid="frame-toast" data-test-frame-toast="">Toast inside the frame</p>
<div data-testid="framed-box" style={FRAMED_MARKER}></div>
