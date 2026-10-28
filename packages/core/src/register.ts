/// <reference types="node" />
import { register } from 'node:module'

/**
 * Lets Node load TypeScript harnesses — and the tests that use them — directly:
 *
 * ```sh
 * node --test --import @harnessed-ts/core/register
 * ```
 *
 * Node's own type stripping cannot run a harness: it refuses `accessor` fields
 * and decorators, and it has no JSX. These hooks hand every `.ts`, `.tsx`, `.mts`
 * and `.cts` file outside `node_modules` to esbuild, which strips the types,
 * lowers TC39 standard decorators and `accessor`, and compiles JSX with the
 * automatic runtime. JavaScript files and dependencies are left to Node.
 *
 * Needs `esbuild` installed alongside, as `harnessedDecorators()` does.
 */
register('./register-hooks.js', import.meta.url)
