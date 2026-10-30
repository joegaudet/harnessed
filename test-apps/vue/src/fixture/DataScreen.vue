<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  getJson,
  getJsonByXhr,
  getProfileHandle,
  messageOf,
  openSocket,
  readFeed,
  search,
} from './data-client'

/**
 * The Vue copy of the React fixture's DataScreen, node for node: a fetch on
 * mount, XHR, a JSON POST, a GraphQL query, a streamed response and a
 * WebSocket, each outcome rendered as its own element.
 */
type Status = 'idle' | 'loading' | 'ready' | 'error'

const userStatus = ref<Status>('loading')
const userName = ref('')
const userMessage = ref('')
let attempt = 0
function loadUser() {
  const current = ++attempt
  userStatus.value = 'loading'
  getJson<{ name: string }>('/api/users/1').then(
    body => {
      if (current !== attempt) return
      userName.value = body.name
      userStatus.value = 'ready'
    },
    (error: unknown) => {
      if (current !== attempt) return
      userMessage.value = messageOf(error)
      userStatus.value = 'error'
    },
  )
}
onMounted(loadUser)
onBeforeUnmount(() => (attempt = -1))

const todoStatus = ref<Status>('idle')
const todos = ref<{ title: string }[]>([])
const todoMessage = ref('')
function loadTodos() {
  todoStatus.value = 'loading'
  getJsonByXhr<{ title: string }[]>('/api/todos').then(
    value => {
      todos.value = value
      todoStatus.value = 'ready'
    },
    (error: unknown) => {
      todoMessage.value = messageOf(error)
      todoStatus.value = 'error'
    },
  )
}

const query = ref('')
const searchStatus = ref<Status>('idle')
const count = ref(0)
const searchMessage = ref('')
function submit() {
  searchStatus.value = 'loading'
  search(query.value).then(
    body => {
      count.value = body.count
      searchStatus.value = 'ready'
    },
    (error: unknown) => {
      searchMessage.value = messageOf(error)
      searchStatus.value = 'error'
    },
  )
}

const profileStatus = ref<Status>('idle')
const handle = ref('')
const profileMessage = ref('')
function loadProfile() {
  profileStatus.value = 'loading'
  getProfileHandle().then(
    result => {
      if (result.error !== undefined) {
        profileMessage.value = result.error
        profileStatus.value = 'error'
      } else {
        handle.value = result.handle
        profileStatus.value = 'ready'
      }
    },
    (error: unknown) => {
      profileMessage.value = messageOf(error)
      profileStatus.value = 'error'
    },
  )
}

const events = ref<string[]>([])
const feedDone = ref(false)
async function openFeed() {
  events.value = []
  feedDone.value = false
  await readFeed(data => (events.value = [...events.value, ...data]))
  feedDone.value = true
}

let socket: WebSocket | null = null
const socketOpen = ref(false)
const messages = ref<string[]>([])
function connect() {
  const next = openSocket()
  next.addEventListener('open', () => (socketOpen.value = true))
  next.addEventListener(
    'message',
    event => (messages.value = [...messages.value, String(event.data)]),
  )
  next.addEventListener('close', () => (socketOpen.value = false))
  socket = next
}
</script>

<template>
  <div data-testid="data-screen">
    <section data-testid="user-panel">
      <p v-if="userStatus === 'loading'" data-testid="user-loading">Loading</p>
      <p v-if="userStatus === 'ready'" data-testid="user-name">{{ userName }}</p>
      <p v-if="userStatus === 'error'" data-testid="user-error">{{ userMessage }}</p>
      <button type="button" @click="loadUser">Reload user</button>
    </section>
    <section data-testid="todo-panel">
      <button type="button" @click="loadTodos">Load todos</button>
      <ul v-if="todoStatus === 'ready'" data-testid="todos">
        <li v-for="todo in todos" :key="todo.title" data-testid="todo">{{ todo.title }}</li>
      </ul>
      <p v-if="todoStatus === 'error'" data-testid="todos-error">{{ todoMessage }}</p>
    </section>
    <form data-testid="search-panel" @submit.prevent="submit">
      <label>
        Query
        <input v-model="query" />
      </label>
      <button type="submit">Search</button>
      <p v-if="searchStatus === 'ready'" data-testid="search-result">{{ count }} results</p>
      <p v-if="searchStatus === 'error'" data-testid="search-error">{{ searchMessage }}</p>
    </form>
    <section data-testid="profile-panel">
      <button type="button" @click="loadProfile">Load profile</button>
      <p v-if="profileStatus === 'ready'" data-testid="profile-handle">{{ handle }}</p>
      <p v-if="profileStatus === 'error'" data-testid="profile-error">{{ profileMessage }}</p>
    </section>
    <section data-testid="feed-panel">
      <button type="button" @click="openFeed">Open feed</button>
      <ul>
        <li v-for="(event, index) in events" :key="index" data-testid="feed-event">{{ event }}</li>
      </ul>
      <p v-if="feedDone" data-testid="feed-done">done</p>
    </section>
    <section data-testid="socket-panel">
      <button type="button" @click="connect">Connect</button>
      <button type="button" @click="socket?.send('ping')">Send ping</button>
      <p v-if="socketOpen" data-testid="socket-open">open</p>
      <ul>
        <li v-for="(message, index) in messages" :key="index" data-testid="socket-message">
          {{ message }}
        </li>
      </ul>
    </section>
  </div>
</template>
