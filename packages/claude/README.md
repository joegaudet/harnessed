# @harnessed-ts/claude

Installs the harness authoring conventions for coding agents.

```bash
npm i -D @harnessed-ts/claude && npx @harnessed-ts/claude install
```

Writes `.claude/skills/harness/` (with templates) and `.claude/rules/harness.md`,
generating the file-placement table from your repo's actual layout, and creates
`harnessed.config.ts` if it is missing.

Re-run after an upgrade: the shipped conventions are refreshed, your config is
left alone. `--dry-run` reports without writing; `--help` lists the layout
overrides.

Full guide, the cross-driver guarantees, and the API: the
[harnessed README](https://github.com/joegaudet/harnessed#readme).

MIT © Joe Gaudet, Jay Seo
