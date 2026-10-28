<script setup lang="ts">
import { ref } from 'vue'
import CardGrid from './CardGrid.vue'
import { CARDS } from './cards'
import DataScreen from './DataScreen.vue'
import FramedPanel from './FramedPanel.vue'
import LoginForm from './LoginForm.vue'
import PortalDialog from './PortalDialog.vue'
import StepOne from './StepOne.vue'
import StepTwo from './StepTwo.vue'

/**
 * The Vue port of the conformance fixture's App: `?view=` picks the component
 * under test and the pathname picks the wizard step, read once at setup as the
 * React original reads them at render. It must render the same tree as the
 * React original — the fixture-parity test holds it to that.
 */
const url = new URL(window.location.href)
const view = url.searchParams.get('view') ?? 'wizard'
const error = url.searchParams.get('error') ?? undefined
const lateDuplicates = url.searchParams.get('late') === '1'
const onStepTwoPath = url.pathname === '/step-two'
const token = url.searchParams.get('token')

const step = ref<'one' | 'two'>('one')
</script>

<template>
  <div data-testid="stage">
    <section v-if="view === 'login'" data-testid="page-login">
      <LoginForm :error="error" :late-duplicates="lateDuplicates" />
    </section>
    <section v-if="view === 'cards'" data-testid="page-cards">
      <CardGrid :cards="CARDS" />
      <!-- Same test id, outside the grid: a scope-dropping query finds this. -->
      <span data-testid="card-hint" data-test-card-hint="">decoy outside the grid</span>
    </section>
    <section v-if="view === 'dialog'" data-testid="page-dialog">
      <PortalDialog />
    </section>
    <section v-if="view === 'frame'" data-testid="page-frame">
      <FramedPanel />
    </section>
    <section v-if="view === 'data'" data-testid="page-data">
      <DataScreen />
    </section>
    <section v-if="view === 'wizard'" data-testid="page-wizard">
      <StepTwo v-if="onStepTwoPath" :token="token" />
      <StepTwo v-else-if="step === 'two'" token="in-page" />
      <StepOne v-else @next="step = 'two'" />
    </section>
  </div>
</template>
