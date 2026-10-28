/**
 * The network calls the React fixture's DataScreen makes, copied as they are:
 * the mock catalog asserts on what is sent and how each outcome reads.
 */

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

export function messageOf(error: unknown): string {
  return error instanceof HttpFailure ? error.message : 'Network error'
}

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) throw await failureOf(response)
  return (await response.json()) as T
}

export function getJsonByXhr<T>(url: string): Promise<T> {
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

const PROFILE_QUERY = 'query GetProfile { profile { handle } }'

/** The profile's handle, or the first GraphQL error. */
export async function getProfileHandle(): Promise<
  { handle: string; error?: undefined } | { error: string }
> {
  const body = await getJson<{
    data?: { profile: { handle: string } } | null
    errors?: { message: string }[]
  }>('/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ operationName: 'GetProfile', query: PROFILE_QUERY, variables: {} }),
  })
  return body.errors !== undefined && body.errors.length > 0
    ? { error: body.errors[0]!.message }
    : { handle: body.data!.profile.handle }
}

export function search(query: string): Promise<{ count: number }> {
  return getJson<{ count: number }>('/api/search?source=form', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-client': 'fixture' },
    body: JSON.stringify({ q: query }),
  })
}

/** Reads `/api/feed` as server-sent events, handing over each batch as it arrives. */
export async function readFeed(onEvents: (data: string[]) => void): Promise<void> {
  const response = await fetch('/api/feed')
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffered = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffered += decoder.decode(value, { stream: true })
    const blocks = buffered.split('\n\n')
    buffered = blocks.pop()!
    const data = blocks.map(block => block.replace(/^data: /, ''))
    if (data.length > 0) onEvents(data)
  }
}

export function openSocket(): WebSocket {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return new WebSocket(`${scheme}://${window.location.host}/socket`)
}
