import { execFile } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { afterAll, describe, expect, it } from 'vitest'

/**
 * `node --import @harnessed-ts/core/register` is how a node:test suite loads a
 * harness, so these run real Node processes against the built hooks — the file
 * the README points at, through the same flag — and `pnpm build` must run first.
 */
const REGISTER = pathToFileURL(fileURLToPath(new URL('../dist/register.js', import.meta.url))).href
const run = promisify(execFile)
const dir = mkdtempSync(join(tmpdir(), 'harnessed-register-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

function write(name: string, source: string): string {
  const path = join(dir, name)
  writeFileSync(path, source)
  return path
}

/** A decorated `accessor` whose getter the decorator replaces. */
write(
  'decorated.harness.ts',
  `
export function Fixed(value: string) {
  return (_target: unknown, _ctx: ClassAccessorDecoratorContext) => ({
    get(): string { return value },
  })
}
export class Harness {
  @Fixed('decorated') accessor field: string = 'raw'
}
`,
)

async function node(entry: string, register = true): Promise<string> {
  const flags = register ? ['--import', REGISTER] : []
  const { stdout } = await run(process.execPath, [...flags, entry], { cwd: dir })
  return stdout.trim()
}

describe('@harnessed-ts/core/register', () => {
  it('runs a decorated accessor with the standard protocol', async () => {
    const entry = write(
      'accessor.ts',
      `import { Harness } from './decorated.harness.ts'\nconsole.log(new Harness().field)\n`,
    )
    expect(await node(entry)).toBe('decorated')
  })

  it('is what makes the file loadable: without it, Node refuses the accessor', async () => {
    const entry = write('refused.ts', `import './decorated.harness.ts'\n`)
    await expect(node(entry, false)).rejects.toThrow()
  })

  it('resolves extensionless and NodeNext `.js` specifiers to the TypeScript file', async () => {
    const bare = write(
      'bare.ts',
      `import { Harness } from './decorated.harness'\nconsole.log(new Harness().field)\n`,
    )
    const nodeNext = write(
      'node-next.ts',
      `import { Harness } from './decorated.harness.js'\nconsole.log(new Harness().field)\n`,
    )
    expect(await node(bare)).toBe('decorated')
    expect(await node(nodeNext)).toBe('decorated')
  })

  it('compiles TSX with the automatic runtime', async () => {
    const entry = write(
      'view.tsx',
      `const element = <b title="x">hi</b>\nconsole.log(typeof element)\n`,
    )
    // No React is installed, so the import of react/jsx-runtime is what fails:
    // proof the JSX was compiled rather than rejected as a syntax error.
    await expect(node(entry)).rejects.toThrow(/react\/jsx-runtime/)
  })

  it('leaves plain JavaScript to Node', async () => {
    const entry = write('plain.mjs', `console.log('plain')\n`)
    expect(await node(entry)).toBe('plain')
  })
})
