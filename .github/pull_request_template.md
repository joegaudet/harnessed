## What and why

<!-- What changes, and the problem it solves. -->

## Parity

<!-- Delete whichever does not apply. -->

- [ ] Behaviour change: a spec in `packages/conformance/specs/catalog.ts` covers it,
      and both drivers pass it.
- [ ] Not a behaviour change (docs, tooling, types, internals).

If a guarantee changed, the **Cross-driver guarantees** list in the README is
updated too.

## Checks

- [ ] `pnpm lint && pnpm format:check && pnpm typecheck && pnpm build`
- [ ] `pnpm test` — rule tests and both conformance drivers
- [ ] `npx changeset` added, if a published package changed
