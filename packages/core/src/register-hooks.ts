/// <reference types="node" />
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/**
 * The module hooks `@harnessed-ts/core/register` installs. They run on Node's
 * hooks thread, so nothing here may assume the test's globals (jsdom and so on).
 */

const TYPESCRIPT = /\.([mc]?)ts(x?)$/
const RELATIVE = /^\.{1,2}\//

interface EsbuildModule {
  transform(code: string, options: Record<string, unknown>): Promise<{ code: string }>
}

interface ResolveContext {
  parentURL?: string
  conditions?: readonly string[]
}
interface ResolveResult {
  url: string
  format?: string | null
  shortCircuit?: boolean
}
type NextResolve = (specifier: string, context?: ResolveContext) => Promise<ResolveResult>

interface LoadContext {
  format?: string | null
  conditions?: readonly string[]
}
interface LoadResult {
  format: string
  source?: string | ArrayBuffer | Uint8Array | null
  shortCircuit?: boolean
}
type NextLoad = (url: string, context?: LoadContext) => Promise<LoadResult>

let esbuild: Promise<EsbuildModule> | undefined

function loadEsbuild(): Promise<EsbuildModule> {
  esbuild ??= (import('esbuild') as unknown as Promise<EsbuildModule>).catch((cause: unknown) => {
    throw new Error(
      'harnessed: @harnessed-ts/core/register needs esbuild, which could not be imported. ' +
        'Install it as a devDependency (`npm i -D esbuild`).',
      { cause },
    )
  })
  return esbuild
}

function isNotFound(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return code === 'ERR_MODULE_NOT_FOUND' || code === 'ERR_UNSUPPORTED_DIR_IMPORT'
}

/**
 * The TypeScript spellings of a relative specifier Node could not find:
 * `./a` → `./a.ts`…, and the NodeNext convention `./a.js` → `./a.ts`.
 */
function candidates(specifier: string): string[] {
  const js = /\.([mc]?)js(x?)$/.exec(specifier)
  if (js !== null) {
    const stem = specifier.slice(0, -js[0].length)
    return [`${stem}.${js[1]}ts${js[2]}`, ...(js[2] === '' ? [`${stem}.tsx`] : [])]
  }
  return [
    `${specifier}.ts`,
    `${specifier}.tsx`,
    `${specifier}.mts`,
    `${specifier}/index.ts`,
    `${specifier}/index.tsx`,
  ]
}

export async function resolve(
  specifier: string,
  context: ResolveContext,
  next: NextResolve,
): Promise<ResolveResult> {
  try {
    return await next(specifier, context)
  } catch (error) {
    const parent = context.parentURL ?? ''
    if (!RELATIVE.test(specifier) || !isNotFound(error) || parent.includes('/node_modules/')) {
      throw error
    }
    for (const candidate of candidates(specifier)) {
      try {
        return await next(candidate, context)
      } catch (retry) {
        if (!isNotFound(retry)) throw retry
      }
    }
    throw error
  }
}

export async function load(url: string, context: LoadContext, next: NextLoad): Promise<LoadResult> {
  const match = TYPESCRIPT.exec(url)
  if (match === null || !url.startsWith('file:') || url.includes('/node_modules/')) {
    return next(url, context)
  }
  const path = fileURLToPath(url)
  const { transform } = await loadEsbuild()
  const commonjs = match[1] === 'c'
  const result = await transform(await readFile(path, 'utf8'), {
    loader: match[2] === 'x' ? 'tsx' : 'ts',
    format: commonjs ? 'cjs' : 'esm',
    // At or below es2022, so esbuild lowers decorators and `accessor`.
    target: 'es2022',
    jsx: 'automatic',
    sourcefile: path,
    sourcemap: 'inline',
    tsconfigRaw: { compilerOptions: { useDefineForClassFields: true, target: 'ES2022' } },
  })
  return { format: commonjs ? 'commonjs' : 'module', source: result.code, shortCircuit: true }
}
