<script lang="ts">
  let { onnext }: { onnext: () => void } = $props()
</script>

<section data-testid="page-step-one">
  <h1>Step one</h1>
  <button type="button" onclick={onnext}>Continue</button>
</section>
