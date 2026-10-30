/**
 * URL matching, shared by every adapter so no runner re-implements it.
 *
 * - `'/users/:id'` — a path on any origin, with named segments.
 * - `'https://api.example.com/users/:id'` — the origin is pinned too.
 * - `*` matches within one segment, `**` across any number of them.
 * - A `RegExp` is tested against the whole URL.
 */

export type UrlPattern = string | RegExp

/** `{ id: string }` for `'/users/:id'`, so a handler's params are checked against its path. */
export type PathParams<Path> = Path extends string
  ? string extends Path
    ? Record<string, string>
    : ParamsOf<StripQuery<Path>>
  : Record<string, string>

type StripQuery<P extends string> = P extends `${infer Head}?${string}` ? Head : P
type ParamsOf<P extends string> = P extends `${string}:${infer Rest}`
  ? Rest extends `${infer Name}/${infer Tail}`
    ? { [K in CleanName<Name>]: string } & ParamsOf<`/${Tail}`>
    : { [K in CleanName<Rest>]: string }
  : P extends `${string}{${infer Name}}${infer Tail}`
    ? { [K in Name]: string } & ParamsOf<Tail>
    : Record<never, never>
// A segment may carry a suffix after its param, such as `:id.json`.
type CleanName<N extends string> = N extends `${infer Name}.${string}` ? Name : N

export interface CompiledPattern {
  /** As written, for messages. */
  readonly source: string
  /** Named params when the URL matches, else `null`. */
  match(url: URL): Record<string, string> | null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
}

/** Compiles a path pattern (no origin) into a RegExp over `URL.pathname`. */
function compilePath(path: string): { regexp: RegExp; names: string[] } {
  const names: string[] = []
  let source = ''
  for (let i = 0; i < path.length;) {
    if (path.startsWith('**', i)) {
      // `/**` at the end also matches the bare prefix: `/api/**` covers `/api`.
      if (path.slice(i + 2) === '' && source.endsWith('/')) {
        source = source.slice(0, -1) + '(?:/.*)?'
      } else {
        source += '.*'
      }
      i += 2
    } else if (path[i] === '*') {
      source += '[^/]*'
      i += 1
    } else if (path[i] === ':' && /[A-Za-z_]/.test(path[i + 1] ?? '')) {
      const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(path.slice(i + 1))![0]
      names.push(name)
      source += '([^/]+?)'
      i += 1 + name.length
    } else if (path[i] === '{' && /^\{[A-Za-z_][A-Za-z0-9_]*\}/.test(path.slice(i))) {
      // OpenAPI's `{id}`, so a path copied from a spec works as written.
      const name = /^\{([A-Za-z_][A-Za-z0-9_]*)\}/.exec(path.slice(i))![1]!
      names.push(name)
      source += '([^/]+?)'
      i += name.length + 2
    } else {
      source += escapeRegExp(path[i]!)
      i += 1
    }
  }
  // A trailing slash is not significant: `/users` and `/users/` are one resource.
  return { regexp: new RegExp(`^${source.replace(/\/$/, '')}/?$`), names }
}

const ABSOLUTE = /^[a-z][a-z0-9+.-]*:\/\//i

/**
 * Turns a pattern into a matcher. A relative pattern matches on any origin,
 * unless a `baseUrl` is given, which pins it to that origin and prefixes its
 * path.
 */
export function compilePattern(pattern: UrlPattern, baseUrl?: string): CompiledPattern {
  if (pattern instanceof RegExp) {
    return {
      source: String(pattern),
      match: url => {
        pattern.lastIndex = 0
        const result = pattern.exec(url.href)
        return result === null ? null : { ...(result.groups ?? {}) }
      },
    }
  }

  let origin: RegExp | null = null
  let path = pattern.split('?')[0]!.split('#')[0]!
  let source = pattern

  if (ABSOLUTE.test(path)) {
    const at = path.indexOf('/', path.indexOf('//') + 2)
    const host = at === -1 ? path : path.slice(0, at)
    path = at === -1 ? '/' : path.slice(at)
    origin = new RegExp(
      `^${host
        .split('**')
        .map(part => part.split('*').map(escapeRegExp).join('[^./]*'))
        .join('.*')}$`,
      'i',
    )
  } else if (baseUrl !== undefined) {
    const base = new URL(baseUrl)
    origin = new RegExp(`^${escapeRegExp(base.origin)}$`, 'i')
    path = base.pathname.replace(/\/$/, '') + (path.startsWith('/') ? path : `/${path}`)
    source = `${base.origin}${path}`
  } else if (!path.startsWith('/') && !path.startsWith('*')) {
    path = `/${path}`
  }

  const { regexp, names } = compilePath(path)
  return {
    source,
    match(url) {
      if (origin !== null && !origin.test(url.origin)) return null
      const result = regexp.exec(url.pathname)
      if (result === null) return null
      const params: Record<string, string> = {}
      names.forEach((name, index) => {
        params[name] = decodeURIComponent(result[index + 1]!)
      })
      return params
    },
  }
}

/** Whether a URL falls under any of the patterns. */
export function inScope(url: URL, scope: readonly CompiledPattern[]): boolean {
  return scope.some(pattern => pattern.match(url) !== null)
}
