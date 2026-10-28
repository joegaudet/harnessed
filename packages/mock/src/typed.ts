import type { ApiMock } from './api-mock'
import type { MockedRoute, RouteBuilder } from './handler'
import type {
  OpenApiParams,
  OpenApiRequestBody,
  OpenApiResponse,
  OperationOf,
  PathsWith,
} from './openapi'
import type { MockReply, MockRequest } from './types'

type Answer<Op> = OpenApiResponse<Op> | MockReply | undefined

/** A route builder whose params, request body and reply are typed by the OpenAPI operation. */
export type TypedRoute<Op, State> = Omit<
  RouteBuilder<OpenApiParams<Op>, State, OpenApiRequestBody<Op>>,
  'reply'
> & {
  reply(
    respond:
      | Answer<Op>
      | ((
          request: MockRequest<OpenApiParams<Op>, State> & {
            readonly body: OpenApiRequestBody<Op>
          },
        ) => Answer<Op> | Promise<Answer<Op>>),
  ): Promise<MockedRoute>
}

/** `api`, with every path, param and body checked against an openapi-typescript `paths` type. */
export interface TypedApi<Paths, State> {
  get<P extends PathsWith<Paths, 'get'>>(path: P): TypedRoute<OperationOf<Paths, P, 'get'>, State>
  post<P extends PathsWith<Paths, 'post'>>(
    path: P,
  ): TypedRoute<OperationOf<Paths, P, 'post'>, State>
  put<P extends PathsWith<Paths, 'put'>>(path: P): TypedRoute<OperationOf<Paths, P, 'put'>, State>
  patch<P extends PathsWith<Paths, 'patch'>>(
    path: P,
  ): TypedRoute<OperationOf<Paths, P, 'patch'>, State>
  delete<P extends PathsWith<Paths, 'delete'>>(
    path: P,
  ): TypedRoute<OperationOf<Paths, P, 'delete'>, State>
}

/**
 * Types an `ApiMock` by the `paths` interface openapi-typescript generates, so a
 * typo in a path or a reply missing a required field is a type error.
 *
 * ```ts
 * import type { paths } from './generated/api'
 * const typed = typedApi<paths>(mock(env), { base: '/api' })
 * await typed.get('/users/{id}').reply(({ params }) => ({ id: params.id, name: 'Ada' }))
 * ```
 *
 * `base` is the server URL's path, which openapi-typescript leaves off `paths`.
 */
export function typedApi<Paths, State = unknown>(
  api: ApiMock<State>,
  options?: { base?: string },
): TypedApi<Paths, State> {
  const base = (options?.base ?? '').replace(/\/$/, '')
  const at = (method: string) => (path: string) => api.route(method, `${base}${path}`) as never
  return {
    get: at('GET'),
    post: at('POST'),
    put: at('PUT'),
    patch: at('PATCH'),
    delete: at('DELETE'),
  }
}
