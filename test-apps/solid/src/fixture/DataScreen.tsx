import { createSignal, For, onCleanup, Show } from 'solid-js'
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
 * The Solid copy of the React fixture's DataScreen, node for node: a fetch on
 * mount, XHR, a JSON POST, a GraphQL query, a streamed response and a
 * WebSocket, each outcome rendered as its own element.
 */

type Status = 'idle' | 'loading' | 'ready' | 'error'

function UserPanel() {
  const [status, setStatus] = createSignal<Status>('loading')
  const [name, setName] = createSignal('')
  const [message, setMessage] = createSignal('')
  let attempt = 0
  const load = () => {
    const current = ++attempt
    setStatus('loading')
    getJson<{ name: string }>('/api/users/1').then(
      body => {
        if (current !== attempt) return
        setName(body.name)
        setStatus('ready')
      },
      (error: unknown) => {
        if (current !== attempt) return
        setMessage(messageOf(error))
        setStatus('error')
      },
    )
  }
  load()
  onCleanup(() => (attempt = -1))
  return (
    <section data-testid="user-panel">
      <Show when={status() === 'loading'}>
        <p data-testid="user-loading">Loading</p>
      </Show>
      <Show when={status() === 'ready'}>
        <p data-testid="user-name">{name()}</p>
      </Show>
      <Show when={status() === 'error'}>
        <p data-testid="user-error">{message()}</p>
      </Show>
      <button type="button" onClick={load}>
        Reload user
      </button>
    </section>
  )
}

function TodoPanel() {
  const [status, setStatus] = createSignal<Status>('idle')
  const [todos, setTodos] = createSignal<{ title: string }[]>([])
  const [message, setMessage] = createSignal('')
  const load = () => {
    setStatus('loading')
    getJsonByXhr<{ title: string }[]>('/api/todos').then(
      value => {
        setTodos(value)
        setStatus('ready')
      },
      (error: unknown) => {
        setMessage(messageOf(error))
        setStatus('error')
      },
    )
  }
  return (
    <section data-testid="todo-panel">
      <button type="button" onClick={load}>
        Load todos
      </button>
      <Show when={status() === 'ready'}>
        <ul data-testid="todos">
          <For each={todos()}>{todo => <li data-testid="todo">{todo.title}</li>}</For>
        </ul>
      </Show>
      <Show when={status() === 'error'}>
        <p data-testid="todos-error">{message()}</p>
      </Show>
    </section>
  )
}

function SearchPanel() {
  const [query, setQuery] = createSignal('')
  const [status, setStatus] = createSignal<Status>('idle')
  const [count, setCount] = createSignal(0)
  const [message, setMessage] = createSignal('')
  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    setStatus('loading')
    search(query()).then(
      body => {
        setCount(body.count)
        setStatus('ready')
      },
      (error: unknown) => {
        setMessage(messageOf(error))
        setStatus('error')
      },
    )
  }
  return (
    <form data-testid="search-panel" onSubmit={submit}>
      <label>
        Query
        <input value={query()} onInput={event => setQuery(event.currentTarget.value)} />
      </label>
      <button type="submit">Search</button>
      <Show when={status() === 'ready'}>
        <p data-testid="search-result">{count()} results</p>
      </Show>
      <Show when={status() === 'error'}>
        <p data-testid="search-error">{message()}</p>
      </Show>
    </form>
  )
}

function ProfilePanel() {
  const [status, setStatus] = createSignal<Status>('idle')
  const [handle, setHandle] = createSignal('')
  const [message, setMessage] = createSignal('')
  const load = () => {
    setStatus('loading')
    getProfileHandle().then(
      result => {
        if (result.error !== undefined) {
          setMessage(result.error)
          setStatus('error')
        } else {
          setHandle(result.handle)
          setStatus('ready')
        }
      },
      (error: unknown) => {
        setMessage(messageOf(error))
        setStatus('error')
      },
    )
  }
  return (
    <section data-testid="profile-panel">
      <button type="button" onClick={load}>
        Load profile
      </button>
      <Show when={status() === 'ready'}>
        <p data-testid="profile-handle">{handle()}</p>
      </Show>
      <Show when={status() === 'error'}>
        <p data-testid="profile-error">{message()}</p>
      </Show>
    </section>
  )
}

function FeedPanel() {
  const [events, setEvents] = createSignal<string[]>([])
  const [done, setDone] = createSignal(false)
  const open = async () => {
    setEvents([])
    setDone(false)
    await readFeed(data => setEvents(previous => [...previous, ...data]))
    setDone(true)
  }
  return (
    <section data-testid="feed-panel">
      <button type="button" onClick={() => void open()}>
        Open feed
      </button>
      <ul>
        <For each={events()}>{event => <li data-testid="feed-event">{event}</li>}</For>
      </ul>
      <Show when={done()}>
        <p data-testid="feed-done">done</p>
      </Show>
    </section>
  )
}

function SocketPanel() {
  let socket: WebSocket | null = null
  const [open, setOpen] = createSignal(false)
  const [messages, setMessages] = createSignal<string[]>([])
  const connect = () => {
    const next = openSocket()
    next.addEventListener('open', () => setOpen(true))
    next.addEventListener('message', event =>
      setMessages(previous => [...previous, String(event.data)]),
    )
    next.addEventListener('close', () => setOpen(false))
    socket = next
  }
  return (
    <section data-testid="socket-panel">
      <button type="button" onClick={connect}>
        Connect
      </button>
      <button type="button" onClick={() => socket?.send('ping')}>
        Send ping
      </button>
      <Show when={open()}>
        <p data-testid="socket-open">open</p>
      </Show>
      <ul>
        <For each={messages()}>{message => <li data-testid="socket-message">{message}</li>}</For>
      </ul>
    </section>
  )
}

export function DataScreen() {
  return (
    <div data-testid="data-screen">
      <UserPanel />
      <TodoPanel />
      <SearchPanel />
      <ProfilePanel />
      <FeedPanel />
      <SocketPanel />
    </div>
  )
}
