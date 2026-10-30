import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { on } from '@ember/modifier';
import { registerDestructor } from '@ember/destroyable';
import type Owner from '@ember/owner';

/**
 * The Glimmer copy of the React fixture's DataScreen, node for node: a fetch on
 * mount, XHR, a JSON POST, a GraphQL query, a streamed response and a
 * WebSocket, each outcome rendered as its own element.
 */

type Status = 'idle' | 'loading' | 'ready' | 'error';

/** An HTTP failure, told apart from a network one by type. */
class HttpFailure extends Error {}

/** A problem+json `title` when there is one, else the status code. */
async function failureOf(response: Response): Promise<HttpFailure> {
  if ((response.headers.get('content-type') ?? '').includes('json')) {
    try {
      const body = (await response.json()) as { title?: string };
      if (typeof body.title === 'string') return new HttpFailure(body.title);
    } catch {
      // Not JSON after all; the status will do.
    }
  }
  return new HttpFailure(String(response.status));
}

function messageOf(error: unknown): string {
  return error instanceof HttpFailure ? error.message : 'Network error';
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw await failureOf(response);
  return (await response.json()) as T;
}

function getJsonByXhr<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', url);
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve(JSON.parse(request.responseText) as T);
      else reject(new HttpFailure(String(request.status)));
    };
    request.onerror = () => reject(new Error('network'));
    request.send();
  });
}

class UserPanel extends Component {
  @tracked status: Status = 'loading';
  @tracked name = '';
  @tracked message = '';
  #attempt = 0;

  constructor(owner: Owner, args: object) {
    super(owner, args);
    this.load();
    registerDestructor(this, () => (this.#attempt = -1));
  }

  load = () => {
    const attempt = ++this.#attempt;
    this.status = 'loading';
    getJson<{ name: string }>('/api/users/1').then(
      (body) => {
        if (attempt !== this.#attempt) return;
        this.name = body.name;
        this.status = 'ready';
      },
      (error: unknown) => {
        if (attempt !== this.#attempt) return;
        this.message = messageOf(error);
        this.status = 'error';
      },
    );
  };

  get is() {
    return {
      loading: this.status === 'loading',
      ready: this.status === 'ready',
      error: this.status === 'error',
    };
  }

  <template>
    <section data-testid="user-panel">
      {{#if this.is.loading}}<p data-testid="user-loading">Loading</p>{{/if}}
      {{#if this.is.ready}}<p data-testid="user-name">{{this.name}}</p>{{/if}}
      {{#if this.is.error}}<p data-testid="user-error">{{this.message}}</p>{{/if}}
      <button type="button" {{on "click" this.load}}>Reload user</button>
    </section>
  </template>
}

class TodoPanel extends Component {
  @tracked status: Status = 'idle';
  @tracked todos: { title: string }[] = [];
  @tracked message = '';

  load = () => {
    this.status = 'loading';
    getJsonByXhr<{ title: string }[]>('/api/todos').then(
      (todos) => {
        this.todos = todos;
        this.status = 'ready';
      },
      (error: unknown) => {
        this.message = messageOf(error);
        this.status = 'error';
      },
    );
  };

  get ready() {
    return this.status === 'ready';
  }

  get failed() {
    return this.status === 'error';
  }

  <template>
    <section data-testid="todo-panel">
      <button type="button" {{on "click" this.load}}>Load todos</button>
      {{#if this.ready}}
        <ul data-testid="todos">
          {{#each this.todos as |todo|}}<li data-testid="todo">{{todo.title}}</li>{{/each}}
        </ul>
      {{/if}}
      {{#if this.failed}}<p data-testid="todos-error">{{this.message}}</p>{{/if}}
    </section>
  </template>
}

class SearchPanel extends Component {
  @tracked query = '';
  @tracked status: Status = 'idle';
  @tracked count = 0;
  @tracked message = '';

  update = (event: Event) => {
    this.query = (event.target as HTMLInputElement).value;
  };

  submit = (event: Event) => {
    event.preventDefault();
    this.status = 'loading';
    getJson<{ count: number }>('/api/search?source=form', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-client': 'fixture' },
      body: JSON.stringify({ q: this.query }),
    }).then(
      (body) => {
        this.count = body.count;
        this.status = 'ready';
      },
      (error: unknown) => {
        this.message = messageOf(error);
        this.status = 'error';
      },
    );
  };

  get ready() {
    return this.status === 'ready';
  }

  get failed() {
    return this.status === 'error';
  }

  <template>
    <form data-testid="search-panel" {{on "submit" this.submit}}>
      <label>
        Query
        <input value={{this.query}} {{on "input" this.update}} />
      </label>
      <button type="submit">Search</button>
      {{#if this.ready}}<p data-testid="search-result">{{this.count}} results</p>{{/if}}
      {{#if this.failed}}<p data-testid="search-error">{{this.message}}</p>{{/if}}
    </form>
  </template>
}

const PROFILE_QUERY = 'query GetProfile { profile { handle } }';

class ProfilePanel extends Component {
  @tracked status: Status = 'idle';
  @tracked handle = '';
  @tracked message = '';

  load = () => {
    this.status = 'loading';
    getJson<{ data?: { profile: { handle: string } } | null; errors?: { message: string }[] }>(
      '/graphql',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ operationName: 'GetProfile', query: PROFILE_QUERY, variables: {} }),
      },
    ).then(
      (body) => {
        if (body.errors !== undefined && body.errors.length > 0) {
          this.message = body.errors[0]!.message;
          this.status = 'error';
        } else {
          this.handle = body.data!.profile.handle;
          this.status = 'ready';
        }
      },
      (error: unknown) => {
        this.message = messageOf(error);
        this.status = 'error';
      },
    );
  };

  get ready() {
    return this.status === 'ready';
  }

  get failed() {
    return this.status === 'error';
  }

  <template>
    <section data-testid="profile-panel">
      <button type="button" {{on "click" this.load}}>Load profile</button>
      {{#if this.ready}}<p data-testid="profile-handle">{{this.handle}}</p>{{/if}}
      {{#if this.failed}}<p data-testid="profile-error">{{this.message}}</p>{{/if}}
    </section>
  </template>
}

class FeedPanel extends Component {
  @tracked events: string[] = [];
  @tracked done = false;

  open = async () => {
    this.events = [];
    this.done = false;
    const response = await fetch('/api/feed');
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffered = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      const blocks = buffered.split('\n\n');
      buffered = blocks.pop()!;
      const data = blocks.map((block) => block.replace(/^data: /, ''));
      if (data.length > 0) this.events = [...this.events, ...data];
    }
    this.done = true;
  };

  start = () => {
    void this.open();
  };

  <template>
    <section data-testid="feed-panel">
      <button type="button" {{on "click" this.start}}>Open feed</button>
      <ul>
        {{#each this.events as |event|}}<li data-testid="feed-event">{{event}}</li>{{/each}}
      </ul>
      {{#if this.done}}<p data-testid="feed-done">done</p>{{/if}}
    </section>
  </template>
}

class SocketPanel extends Component {
  socket: WebSocket | null = null;
  @tracked open = false;
  @tracked messages: string[] = [];

  connect = () => {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${scheme}://${window.location.host}/socket`);
    socket.addEventListener('open', () => (this.open = true));
    socket.addEventListener('message', (event) => {
      this.messages = [...this.messages, String(event.data)];
    });
    socket.addEventListener('close', () => (this.open = false));
    this.socket = socket;
  };

  ping = () => {
    this.socket?.send('ping');
  };

  <template>
    <section data-testid="socket-panel">
      <button type="button" {{on "click" this.connect}}>Connect</button>
      <button type="button" {{on "click" this.ping}}>Send ping</button>
      {{#if this.open}}<p data-testid="socket-open">open</p>{{/if}}
      <ul>
        {{#each this.messages as |message|}}<li data-testid="socket-message">{{message}}</li>{{/each}}
      </ul>
    </section>
  </template>
}

<template>
  <div data-testid="data-screen">
    <UserPanel />
    <TodoPanel />
    <SearchPanel />
    <ProfilePanel />
    <FeedPanel />
    <SocketPanel />
  </div>
</template>
