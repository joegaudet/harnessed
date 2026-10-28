<!--
  The Svelte copy of the React fixture's DataScreen, node for node: a fetch on
  mount, XHR, a JSON POST, a GraphQL query, a streamed response and a
  WebSocket, each outcome rendered as its own element.
-->
<script lang="ts">
  import { onDestroy } from 'svelte'
  import {
    getJson,
    getJsonByXhr,
    getProfileHandle,
    messageOf,
    openSocket,
    readFeed,
    search,
  } from './data-client'

  type Status = 'idle' | 'loading' | 'ready' | 'error'

  let userStatus = $state<Status>('loading')
  let userName = $state('')
  let userMessage = $state('')
  let attempt = 0
  function loadUser() {
    const current = ++attempt
    userStatus = 'loading'
    getJson<{ name: string }>('/api/users/1').then(
      body => {
        if (current !== attempt) return
        userName = body.name
        userStatus = 'ready'
      },
      (error: unknown) => {
        if (current !== attempt) return
        userMessage = messageOf(error)
        userStatus = 'error'
      },
    )
  }
  loadUser()
  onDestroy(() => (attempt = -1))

  let todoStatus = $state<Status>('idle')
  let todos = $state<{ title: string }[]>([])
  let todoMessage = $state('')
  function loadTodos() {
    todoStatus = 'loading'
    getJsonByXhr<{ title: string }[]>('/api/todos').then(
      value => {
        todos = value
        todoStatus = 'ready'
      },
      (error: unknown) => {
        todoMessage = messageOf(error)
        todoStatus = 'error'
      },
    )
  }

  let query = $state('')
  let searchStatus = $state<Status>('idle')
  let count = $state(0)
  let searchMessage = $state('')
  function submit(event: SubmitEvent) {
    event.preventDefault()
    searchStatus = 'loading'
    search(query).then(
      body => {
        count = body.count
        searchStatus = 'ready'
      },
      (error: unknown) => {
        searchMessage = messageOf(error)
        searchStatus = 'error'
      },
    )
  }

  let profileStatus = $state<Status>('idle')
  let handle = $state('')
  let profileMessage = $state('')
  function loadProfile() {
    profileStatus = 'loading'
    getProfileHandle().then(
      result => {
        if (result.error !== undefined) {
          profileMessage = result.error
          profileStatus = 'error'
        } else {
          handle = result.handle
          profileStatus = 'ready'
        }
      },
      (error: unknown) => {
        profileMessage = messageOf(error)
        profileStatus = 'error'
      },
    )
  }

  let events = $state<string[]>([])
  let feedDone = $state(false)
  async function openFeed() {
    events = []
    feedDone = false
    await readFeed(data => (events = [...events, ...data]))
    feedDone = true
  }

  let socket: WebSocket | null = null
  let socketOpen = $state(false)
  let messages = $state<string[]>([])
  function connect() {
    const next = openSocket()
    next.addEventListener('open', () => (socketOpen = true))
    next.addEventListener('message', event => (messages = [...messages, String(event.data)]))
    next.addEventListener('close', () => (socketOpen = false))
    socket = next
  }
</script>

<div data-testid="data-screen">
  <section data-testid="user-panel">
    {#if userStatus === 'loading'}<p data-testid="user-loading">Loading</p>{/if}
    {#if userStatus === 'ready'}<p data-testid="user-name">{userName}</p>{/if}
    {#if userStatus === 'error'}<p data-testid="user-error">{userMessage}</p>{/if}
    <button type="button" onclick={loadUser}>Reload user</button>
  </section>
  <section data-testid="todo-panel">
    <button type="button" onclick={loadTodos}>Load todos</button>
    {#if todoStatus === 'ready'}
      <ul data-testid="todos">
        {#each todos as todo (todo.title)}<li data-testid="todo">{todo.title}</li>{/each}
      </ul>
    {/if}
    {#if todoStatus === 'error'}<p data-testid="todos-error">{todoMessage}</p>{/if}
  </section>
  <form data-testid="search-panel" onsubmit={submit}>
    <label>
      Query
      <input bind:value={query} />
    </label>
    <button type="submit">Search</button>
    {#if searchStatus === 'ready'}<p data-testid="search-result">{count} results</p>{/if}
    {#if searchStatus === 'error'}<p data-testid="search-error">{searchMessage}</p>{/if}
  </form>
  <section data-testid="profile-panel">
    <button type="button" onclick={loadProfile}>Load profile</button>
    {#if profileStatus === 'ready'}<p data-testid="profile-handle">{handle}</p>{/if}
    {#if profileStatus === 'error'}<p data-testid="profile-error">{profileMessage}</p>{/if}
  </section>
  <section data-testid="feed-panel">
    <button type="button" onclick={() => void openFeed()}>Open feed</button>
    <ul>
      {#each events as event, index (index)}<li data-testid="feed-event">{event}</li>{/each}
    </ul>
    {#if feedDone}<p data-testid="feed-done">done</p>{/if}
  </section>
  <section data-testid="socket-panel">
    <button type="button" onclick={connect}>Connect</button>
    <button type="button" onclick={() => socket?.send('ping')}>Send ping</button>
    {#if socketOpen}<p data-testid="socket-open">open</p>{/if}
    <ul>
      {#each messages as message, index (index)}<li data-testid="socket-message">{message}</li>{/each}
    </ul>
  </section>
</div>
