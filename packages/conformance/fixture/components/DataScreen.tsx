import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

/**
 * A screen that talks to a backend in every way the mock catalog covers: a
 * `fetch` on mount, XHR, a JSON POST, a GraphQL query, a streamed response and a
 * WebSocket. Every outcome — loading, data, an HTTP error, a network failure —
 * renders as its own element, so a spec can tell them apart without timing.
 */

type Load<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; value: T }
  | { status: 'error'; message: string }

/** An HTTP failure, told apart from a network one by type. */
class HttpFailure extends Error {}

/** A problem+json `title` when there is one, else the status code. */
async function failureOf(response: Response): Promise<HttpFailure> {
  if ((response.headers.get('content-type') ?? '').includes('json')) {
    try {
      const body = (await response.json()) as { title?: string }
      if (typeof body.title === 'string') return new HttpFailure(body.title)
    } catch {
      // Not JSON after all; the status will do.
    }
  }
  return new HttpFailure(String(response.status))
}

function messageOf(error: unknown): string {
  return error instanceof HttpFailure ? error.message : 'Network error'
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) throw await failureOf(response)
  return (await response.json()) as T
}

function getJsonByXhr<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('GET', url)
    request.onload = () => {
      if (request.status >= 200 && request.status < 300)
        resolve(JSON.parse(request.responseText) as T)
      else reject(new HttpFailure(String(request.status)))
    }
    request.onerror = () => reject(new Error('network'))
    request.send()
  })
}

function UserPanel() {
  const [user, setUser] = useState<Load<string>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    setUser({ status: 'loading' })
    getJson<{ name: string }>('/api/users/1').then(
      body => live && setUser({ status: 'ready', value: body.name }),
      error => live && setUser({ status: 'error', message: messageOf(error) }),
    )
    return () => {
      live = false
    }
  }, [attempt])
  return (
    <section data-testid="user-panel">
      {user.status === 'loading' ? <p data-testid="user-loading">Loading</p> : null}
      {user.status === 'ready' ? <p data-testid="user-name">{user.value}</p> : null}
      {user.status === 'error' ? <p data-testid="user-error">{user.message}</p> : null}
      <button type="button" onClick={() => setAttempt(n => n + 1)}>
        Reload user
      </button>
    </section>
  )
}

function TodoPanel() {
  const [todos, setTodos] = useState<Load<{ title: string }[]>>({ status: 'idle' })
  const load = () => {
    setTodos({ status: 'loading' })
    getJsonByXhr<{ title: string }[]>('/api/todos').then(
      value => setTodos({ status: 'ready', value }),
      error => setTodos({ status: 'error', message: messageOf(error) }),
    )
  }
  return (
    <section data-testid="todo-panel">
      <button type="button" onClick={load}>
        Load todos
      </button>
      {todos.status === 'ready' ? (
        <ul data-testid="todos">
          {todos.value.map(todo => (
            <li data-testid="todo" key={todo.title}>
              {todo.title}
            </li>
          ))}
        </ul>
      ) : null}
      {todos.status === 'error' ? <p data-testid="todos-error">{todos.message}</p> : null}
    </section>
  )
}

function SearchPanel() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<Load<number>>({ status: 'idle' })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    setResult({ status: 'loading' })
    getJson<{ count: number }>('/api/search?source=form', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-client': 'fixture' },
      body: JSON.stringify({ q: query }),
    }).then(
      body => setResult({ status: 'ready', value: body.count }),
      error => setResult({ status: 'error', message: messageOf(error) }),
    )
  }
  return (
    <form data-testid="search-panel" onSubmit={submit}>
      <label>
        Query
        <input value={query} onChange={event => setQuery(event.target.value)} />
      </label>
      <button type="submit">Search</button>
      {result.status === 'ready' ? <p data-testid="search-result">{result.value} results</p> : null}
      {result.status === 'error' ? <p data-testid="search-error">{result.message}</p> : null}
    </form>
  )
}

const PROFILE_QUERY = 'query GetProfile { profile { handle } }'

function ProfilePanel() {
  const [profile, setProfile] = useState<Load<string>>({ status: 'idle' })
  const load = () => {
    setProfile({ status: 'loading' })
    getJson<{ data?: { profile: { handle: string } } | null; errors?: { message: string }[] }>(
      '/graphql',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ operationName: 'GetProfile', query: PROFILE_QUERY, variables: {} }),
      },
    ).then(
      body =>
        setProfile(
          body.errors !== undefined && body.errors.length > 0
            ? { status: 'error', message: body.errors[0]!.message }
            : { status: 'ready', value: body.data!.profile.handle },
        ),
      error => setProfile({ status: 'error', message: messageOf(error) }),
    )
  }
  return (
    <section data-testid="profile-panel">
      <button type="button" onClick={load}>
        Load profile
      </button>
      {profile.status === 'ready' ? <p data-testid="profile-handle">{profile.value}</p> : null}
      {profile.status === 'error' ? <p data-testid="profile-error">{profile.message}</p> : null}
    </section>
  )
}

function FeedPanel() {
  const [events, setEvents] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const open = async () => {
    setEvents([])
    setDone(false)
    const response = await fetch('/api/feed')
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffered = ''
    for (;;) {
      const { value, done: finished } = await reader.read()
      if (finished) break
      buffered += decoder.decode(value, { stream: true })
      const blocks = buffered.split('\n\n')
      buffered = blocks.pop()!
      const data = blocks.map(block => block.replace(/^data: /, ''))
      if (data.length > 0) setEvents(previous => [...previous, ...data])
    }
    setDone(true)
  }
  return (
    <section data-testid="feed-panel">
      <button type="button" onClick={() => void open()}>
        Open feed
      </button>
      <ul>
        {events.map((event, index) => (
          <li data-testid="feed-event" key={index}>
            {event}
          </li>
        ))}
      </ul>
      {done ? <p data-testid="feed-done">done</p> : null}
    </section>
  )
}

function SocketPanel() {
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<string[]>([])
  const connect = () => {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const next = new WebSocket(`${scheme}://${window.location.host}/socket`)
    next.addEventListener('open', () => setOpen(true))
    next.addEventListener('message', event =>
      setMessages(previous => [...previous, String(event.data)]),
    )
    next.addEventListener('close', () => setOpen(false))
    setSocket(next)
  }
  return (
    <section data-testid="socket-panel">
      <button type="button" onClick={connect}>
        Connect
      </button>
      <button type="button" onClick={() => socket?.send('ping')}>
        Send ping
      </button>
      {open ? <p data-testid="socket-open">open</p> : null}
      <ul>
        {messages.map((message, index) => (
          <li data-testid="socket-message" key={index}>
            {message}
          </li>
        ))}
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
