---
'@harnessed-ts/config': patch
'@harnessed-ts/claude': patch
---

`loadConfigFor` no longer walks to the filesystem root: it stops at the project root — the nearest git checkout or workspace root (`.git`, `pnpm-workspace.yaml`, or a `package.json` with `workspaces`), else the nearest `package.json` — so a `harnessed.config.ts` above the project is never executed. A config at a monorepo's root still governs its nested packages. `npx @harnessed-ts/claude install` now escapes the values it writes into `harnessed.config.ts`, so a path containing a quote or backslash no longer produces a broken file.
