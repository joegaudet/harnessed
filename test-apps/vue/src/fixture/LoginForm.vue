<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

export type LoginStatus = 'idle' | 'submitting' | 'done'

const props = defineProps<{
  onSubmit?: (email: string, password: string) => void
  /** Renders the error line when set. Absent otherwise — exercises count()/isAbsent(). */
  error?: string
  /** Renders two same-id nodes after a delay, for the late-duplicate case. */
  lateDuplicates?: boolean
}>()

const email = ref('')
const password = ref('')
const status = ref<LoginStatus>('idle')
const late = ref(false)
const uploads = ref('')

const label = computed(() =>
  status.value === 'done' ? 'Signed in' : status.value === 'submitting' ? 'Signing in…' : 'Sign in',
)

// What a change listener sees in the input's own `files`: names and sizes, so
// the contents are known to have arrived too.
function onFiles(event: Event) {
  const files = (event.currentTarget as HTMLInputElement).files ?? []
  uploads.value = [...files].map(file => `${file.name}:${file.size}`).join(', ')
}

function submit() {
  status.value = 'submitting'
  props.onSubmit?.(email.value, password.value)
  status.value = 'done'
}

let timer: ReturnType<typeof setTimeout> | undefined
onMounted(() => {
  if (props.lateDuplicates) timer = setTimeout(() => (late.value = true), 150)
})
onBeforeUnmount(() => clearTimeout(timer))
</script>

<!--
  Labels, inputs, a placeholder, a submit button, a conditionally rendered error,
  and a control whose accessible name changes with its state — the Vue copy of
  the React fixture's LoginForm, node for node.
-->
<template>
  <form data-testid="login-form" @submit.prevent="submit">
    <h1>Sign in</h1>

    <label for="login-email">Email</label>
    <input
      id="login-email"
      v-model="email"
      data-testid="login-email"
      placeholder="you@example.com"
    />

    <label for="login-password">Password</label>
    <input id="login-password" v-model="password" type="password" />

    <label for="login-remember">Remember me</label>
    <input id="login-remember" type="checkbox" />

    <label for="login-plan">Plan</label>
    <select id="login-plan">
      <option value="free" selected>Free</option>
      <option value="pro">Pro</option>
    </select>

    <label for="login-addons">Add-ons</label>
    <select id="login-addons" multiple>
      <option value="sms" selected>SMS</option>
      <option value="voice">Voice</option>
      <option value="fax">Fax</option>
    </select>

    <!-- `disabled` is inherited: this control has no disabled attribute of its own. -->
    <fieldset disabled>
      <label for="login-referral">Referral code</label>
      <input id="login-referral" data-testid="login-referral" />
    </fieldset>

    <label for="login-avatar">Avatar</label>
    <input id="login-avatar" type="file" @change="onFiles" />

    <label for="login-attachments">Attachments</label>
    <input id="login-attachments" type="file" multiple @change="onFiles" />

    <!-- A div, not a <p>: the late paragraph is found by role, and must stay the only one. -->
    <div data-testid="login-uploads">{{ uploads }}</div>

    <!-- Appears after a beat, as two nodes: a strict violation that cannot be
         seen by a query that only looks once. -->
    <p v-if="late">
      <span data-testid="login-late">first</span>
      <span data-testid="login-late">second</span>
    </p>

    <p v-if="error" data-testid="login-error">{{ error }}</p>

    <button type="submit" data-testid="login-submit" :data-status="status" :disabled="!email">
      {{ label }}
    </button>
  </form>
</template>
