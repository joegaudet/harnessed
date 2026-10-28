import { HANDLER } from './handler'
import type { HandlerDefinition } from './handler'
import type { MockRequest } from './types'

/**
 * The part of an MSW `RequestHandler` this bridge uses. Duck-typed so `msw` is
 * never imported: a suite that already has handlers has `msw` installed, and
 * one that does not never pays for it.
 */
export interface MswHandlerLike {
  info: { header: string }
  run(args: {
    request: Request
    requestId: string
    resolutionContext?: { baseUrl?: string }
  }): Promise<{ response?: Response } | null | undefined>
}

export function isMswHandler(value: unknown): value is MswHandlerLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as MswHandlerLike).run === 'function' &&
    typeof (value as MswHandlerLike).info === 'object'
  )
}

let nextId = 0

function toFetchRequest(request: MockRequest): Request {
  const init: RequestInit = { method: request.method, headers: request.headers }
  if (request.rawBody !== null && request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.rawBody as BodyInit
  }
  return new Request(request.url.href, init)
}

/**
 * Wraps an MSW handler as one of ours. It matches every URL and lets MSW decide:
 * when MSW's handler does not apply, the request falls through to the next one.
 */
export function fromMsw(handler: MswHandlerLike, baseUrl?: string): HandlerDefinition {
  return {
    [HANDLER]: true,
    method: '*',
    pattern: /.*/,
    name: `MSW ${handler.info.header}`,
    async respond(request: MockRequest) {
      const result = await handler.run({
        request: toFetchRequest(request),
        requestId: `harnessed-${++nextId}`,
        // MSW resolves a relative path against `location`, which only a browser
        // has. The request's own origin gives our rule: relative means any origin.
        resolutionContext: { baseUrl: baseUrl ?? `${request.url.origin}/` },
      })
      return result?.response ?? undefined
    },
  }
}
