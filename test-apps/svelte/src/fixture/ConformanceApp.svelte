<!--
  The Svelte port of the conformance fixture's App: `?view=` picks the component
  under test and the pathname picks the wizard step, read once when the component
  is created, as the React original reads them at render. It must render the same
  tree as the React original — the fixture-parity test holds it to that.
-->
<script lang="ts">
  import CardGrid from './CardGrid.svelte'
  import { CARDS } from './cards'
  import DataScreen from './DataScreen.svelte'
  import FramedPanel from './FramedPanel.svelte'
  import LoginForm from './LoginForm.svelte'
  import PortalDialog from './PortalDialog.svelte'
  import StepOne from './StepOne.svelte'
  import StepTwo from './StepTwo.svelte'

  const url = new URL(window.location.href)
  const view = url.searchParams.get('view') ?? 'wizard'
  const error = url.searchParams.get('error') ?? undefined
  const lateDuplicates = url.searchParams.get('late') === '1'
  const onStepTwoPath = url.pathname === '/step-two'
  const token = url.searchParams.get('token')

  let step = $state<'one' | 'two'>('one')
</script>

<div data-testid="stage">
  {#if view === 'login'}
    <section data-testid="page-login">
      <LoginForm {error} {lateDuplicates} />
    </section>
  {/if}
  {#if view === 'cards'}
    <section data-testid="page-cards">
      <CardGrid cards={CARDS} />
      <!-- Same test id, outside the grid: a scope-dropping query finds this. -->
      <span data-testid="card-hint" data-test-card-hint="">decoy outside the grid</span>
    </section>
  {/if}
  {#if view === 'dialog'}
    <section data-testid="page-dialog">
      <PortalDialog />
    </section>
  {/if}
  {#if view === 'frame'}
    <section data-testid="page-frame">
      <FramedPanel />
    </section>
  {/if}
  {#if view === 'data'}
    <section data-testid="page-data">
      <DataScreen />
    </section>
  {/if}
  {#if view === 'wizard'}
    <section data-testid="page-wizard">
      {#if onStepTwoPath}
        <StepTwo {token} />
      {:else if step === 'two'}
        <StepTwo token="in-page" />
      {:else}
        <StepOne onnext={() => (step = 'two')} />
      {/if}
    </section>
  {/if}
</div>
