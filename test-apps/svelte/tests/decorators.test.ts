// @vitest-environment node
// (esbuild, which the plugin loads, refuses jsdom's TextEncoder.)
import { harnessedDecorators } from '@harnessed-ts/core/vite'
import { describe, expect, it } from 'vitest'

/**
 * `harnessedDecorators()` runs before the Svelte plugin and must leave
 * components to it: esbuild cannot parse a .svelte file. Its default `include`
 * (.ts/.tsx) is what keeps it out, so a source that would otherwise trigger the
 * transform (it has an `@`) proves the id alone decides.
 */
describe('harnessedDecorators() beside the Svelte plugin', () => {
  const plugin = harnessedDecorators()
  const component =
    '<script lang="ts">\n  let { a }: { a: string } = $props()\n</script>\n<p>@{a}</p>\n'

  it('does not transform a .svelte component', async () => {
    expect(await plugin.transform(component, '/app/src/fixture/LoginForm.svelte')).toBeNull()
  })

  it("does not transform a .svelte component's virtual style or script request", async () => {
    expect(
      await plugin.transform(component, '/app/src/Card.svelte?svelte&type=style&lang.css'),
    ).toBeNull()
  })

  it('still lowers `accessor` in a .ts harness next to the components', async () => {
    const harness = 'class A { @dec accessor b = 1 }\nfunction dec(..._: unknown[]) {}\n'
    const result = await plugin.transform(harness, '/app/src/login.harness.ts')
    expect(result?.code).not.toMatch(/\baccessor\s/)
  })
})
