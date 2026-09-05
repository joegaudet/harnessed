# @harnessed-ts/claude

## 0.1.0

First release.

Installs the harness authoring skill, rules, and templates into a repo's `.claude/`
directory, generating the file-placement table from that repo's actual layout. An
existing `harnessed.config.ts` wins over detection, so re-running cannot produce
docs that contradict the config beside them.
