import { Component, DestroyRef, inject, signal } from '@angular/core'
import type { OnInit } from '@angular/core'
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
 * The Angular copy of the React fixture's DataScreen, node for node: a fetch on
 * mount, XHR, a JSON POST, a GraphQL query, a streamed response and a
 * WebSocket, each outcome rendered as its own element. Attribute selectors, so
 * each host IS the element the React fixture renders.
 */

type Status = 'idle' | 'loading' | 'ready' | 'error'

@Component({
  selector: 'section[fixtureUserPanel]',
  host: { 'data-testid': 'user-panel' },
  template: `
    @if (status() === 'loading') {
      <p data-testid="user-loading">Loading</p>
    }
    @if (status() === 'ready') {
      <p data-testid="user-name">{{ name() }}</p>
    }
    @if (status() === 'error') {
      <p data-testid="user-error">{{ message() }}</p>
    }
    <button type="button" (click)="load()">Reload user</button>
  `,
})
export class UserPanel implements OnInit {
  protected readonly status = signal<Status>('loading')
  protected readonly name = signal('')
  protected readonly message = signal('')
  private attempt = 0

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.attempt = -1))
  }

  ngOnInit(): void {
    this.load()
  }

  protected load(): void {
    const attempt = ++this.attempt
    this.status.set('loading')
    getJson<{ name: string }>('/api/users/1').then(
      body => {
        if (attempt !== this.attempt) return
        this.name.set(body.name)
        this.status.set('ready')
      },
      (error: unknown) => {
        if (attempt !== this.attempt) return
        this.message.set(messageOf(error))
        this.status.set('error')
      },
    )
  }
}

@Component({
  selector: 'section[fixtureTodoPanel]',
  host: { 'data-testid': 'todo-panel' },
  template: `
    <button type="button" (click)="load()">Load todos</button>
    @if (status() === 'ready') {
      <ul data-testid="todos">
        @for (todo of todos(); track todo.title) {
          <li data-testid="todo">{{ todo.title }}</li>
        }
      </ul>
    }
    @if (status() === 'error') {
      <p data-testid="todos-error">{{ message() }}</p>
    }
  `,
})
export class TodoPanel {
  protected readonly status = signal<Status>('idle')
  protected readonly todos = signal<{ title: string }[]>([])
  protected readonly message = signal('')

  protected load(): void {
    this.status.set('loading')
    getJsonByXhr<{ title: string }[]>('/api/todos').then(
      todos => {
        this.todos.set(todos)
        this.status.set('ready')
      },
      (error: unknown) => {
        this.message.set(messageOf(error))
        this.status.set('error')
      },
    )
  }
}

@Component({
  selector: 'form[fixtureSearchPanel]',
  host: { 'data-testid': 'search-panel', '(submit)': 'submit($event)' },
  template: `
    <label>
      Query
      <input [value]="query()" (input)="query.set(valueOf($event))" />
    </label>
    <button type="submit">Search</button>
    @if (status() === 'ready') {
      <p data-testid="search-result">{{ count() }} results</p>
    }
    @if (status() === 'error') {
      <p data-testid="search-error">{{ message() }}</p>
    }
  `,
})
export class SearchPanel {
  protected readonly query = signal('')
  protected readonly status = signal<Status>('idle')
  protected readonly count = signal(0)
  protected readonly message = signal('')

  protected valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value
  }

  protected submit(event: Event): void {
    event.preventDefault()
    this.status.set('loading')
    search(this.query()).then(
      body => {
        this.count.set(body.count)
        this.status.set('ready')
      },
      (error: unknown) => {
        this.message.set(messageOf(error))
        this.status.set('error')
      },
    )
  }
}

@Component({
  selector: 'section[fixtureProfilePanel]',
  host: { 'data-testid': 'profile-panel' },
  template: `
    <button type="button" (click)="load()">Load profile</button>
    @if (status() === 'ready') {
      <p data-testid="profile-handle">{{ handle() }}</p>
    }
    @if (status() === 'error') {
      <p data-testid="profile-error">{{ message() }}</p>
    }
  `,
})
export class ProfilePanel {
  protected readonly status = signal<Status>('idle')
  protected readonly handle = signal('')
  protected readonly message = signal('')

  protected load(): void {
    this.status.set('loading')
    getProfileHandle().then(
      result => {
        if (result.error !== undefined) {
          this.message.set(result.error)
          this.status.set('error')
        } else {
          this.handle.set(result.handle)
          this.status.set('ready')
        }
      },
      (error: unknown) => {
        this.message.set(messageOf(error))
        this.status.set('error')
      },
    )
  }
}

@Component({
  selector: 'section[fixtureFeedPanel]',
  host: { 'data-testid': 'feed-panel' },
  template: `
    <button type="button" (click)="start()">Open feed</button>
    <ul>
      @for (event of events(); track $index) {
        <li data-testid="feed-event">{{ event }}</li>
      }
    </ul>
    @if (done()) {
      <p data-testid="feed-done">done</p>
    }
  `,
})
export class FeedPanel {
  protected readonly events = signal<string[]>([])
  protected readonly done = signal(false)

  protected start(): void {
    void this.open()
  }

  private async open(): Promise<void> {
    this.events.set([])
    this.done.set(false)
    await readFeed(data => this.events.update(previous => [...previous, ...data]))
    this.done.set(true)
  }
}

@Component({
  selector: 'section[fixtureSocketPanel]',
  host: { 'data-testid': 'socket-panel' },
  template: `
    <button type="button" (click)="connect()">Connect</button>
    <button type="button" (click)="ping()">Send ping</button>
    @if (open()) {
      <p data-testid="socket-open">open</p>
    }
    <ul>
      @for (message of messages(); track $index) {
        <li data-testid="socket-message">{{ message }}</li>
      }
    </ul>
  `,
})
export class SocketPanel {
  protected readonly open = signal(false)
  protected readonly messages = signal<string[]>([])
  private socket: WebSocket | null = null

  protected connect(): void {
    const socket = openSocket()
    socket.addEventListener('open', () => this.open.set(true))
    socket.addEventListener('message', event =>
      this.messages.update(previous => [...previous, String(event.data)]),
    )
    socket.addEventListener('close', () => this.open.set(false))
    this.socket = socket
  }

  protected ping(): void {
    this.socket?.send('ping')
  }
}

@Component({
  selector: 'div[fixtureDataScreen]',
  host: { 'data-testid': 'data-screen' },
  imports: [UserPanel, TodoPanel, SearchPanel, ProfilePanel, FeedPanel, SocketPanel],
  template: `
    <section fixtureUserPanel></section>
    <section fixtureTodoPanel></section>
    <form fixtureSearchPanel></form>
    <section fixtureProfilePanel></section>
    <section fixtureFeedPanel></section>
    <section fixtureSocketPanel></section>
  `,
})
export class DataScreen {}
