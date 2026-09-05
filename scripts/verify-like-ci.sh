#!/usr/bin/env bash
#
# Run every CI job against a clean clone of HEAD.
#
# Exists because two CI failures got through that a local run had called fine.
# Both had one cause: the working tree carried state CI does not have — a stale
# `dist/` from an earlier build, browsers already installed, a command run from
# inside a package. Testing the working tree tests your machine; testing a fresh
# clone tests the commit.
#
# Usage:  bash scripts/verify-like-ci.sh            # every job
#         bash scripts/verify-like-ci.sh --quick    # skip the browser + TS matrix
#
# Keep the job list below in step with .github/workflows/ci.yml. When they drift,
# this script is the one that lies to you.
set -uo pipefail

QUICK=${1:-}
REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
WORK=$(mktemp -d "${TMPDIR:-/tmp}/harnessed-ci.XXXXXX")
CLONE="$WORK/harnessed"
FAILURES=()

cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

step() { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
bad() {
  printf '  \033[31m✗\033[0m %s\n' "$1"
  FAILURES+=("$1")
}

# CI gives every job its own runner, so no job sees another's build output.
# Sharing one tree here would hide exactly the bug this script exists to catch:
# a job that never builds what it imports, passing because an earlier job did.
isolate() {
  rm -rf "$CLONE"/packages/*/dist "$CLONE"/packages/*/*.tsbuildinfo "$CLONE"/tsconfig.tsbuildinfo
}

run() { # run <label> <command...>
  local label="$1"
  shift
  if "$@" >"$WORK/out.log" 2>&1; then
    ok "$label"
  else
    bad "$label"
    tail -25 "$WORK/out.log" | sed 's/^/      /'
  fi
}

if [ -n "$(git -C "$REPO_ROOT" status --porcelain)" ]; then
  printf '\033[33mNote:\033[0m the working tree is dirty. This verifies HEAD, not your uncommitted changes.\n'
fi

step "Cloning HEAD into a clean tree"
git clone -q --no-local --branch "$(git -C "$REPO_ROOT" branch --show-current)" \
  "$REPO_ROOT" "$CLONE" || {
  bad "clone"
  exit 1
}
cd "$CLONE"
ok "$(git log --oneline -1)"

run "pnpm install --frozen-lockfile" pnpm install --frozen-lockfile

step "job: static"
isolate
run "pnpm format:check" pnpm format:check
run "pnpm build" pnpm build
run "pnpm lint" pnpm lint

step "job: rules"
isolate
run "pnpm build" pnpm build
run "pnpm test:rules" pnpm test:rules

step "job: conformance-dom"
isolate
run "pnpm build" pnpm build
run "pnpm test:dom" pnpm test:dom

if [ "$QUICK" != "--quick" ]; then
  step "job: typecheck (matrix)"
  isolate
  for version in 5.2 6 latest; do
    pnpm add -Dw "typescript@$version" >/dev/null 2>&1
    run "typecheck:packages on ts $version" pnpm typecheck:packages
  done
  git checkout -q -- package.json pnpm-lock.yaml 2>/dev/null || true
  pnpm install --frozen-lockfile >/dev/null 2>&1

  step "job: conformance-playwright"
  isolate
  run "playwright install chromium" pnpm --filter conformance exec playwright install chromium
  run "pnpm build" pnpm build
  run "pnpm test:playwright" pnpm test:playwright

  step "peer-range legs"
  pnpm --filter conformance add -D @testing-library/dom@10 >/dev/null 2>&1
  isolate
  pnpm build >/dev/null 2>&1
  run "test:dom against @testing-library/dom@10" pnpm test:dom
  pnpm --filter conformance add -D @playwright/test@1.62 >/dev/null 2>&1
  isolate
  pnpm build >/dev/null 2>&1
  run "test:playwright against @playwright/test@1.62" pnpm test:playwright
fi

step "Result"
if [ ${#FAILURES[@]} -eq 0 ]; then
  printf '  \033[32mAll jobs passed against a clean clone.\033[0m\n'
  exit 0
fi
printf '  \033[31m%d job(s) failed:\033[0m\n' "${#FAILURES[@]}"
printf '    %s\n' "${FAILURES[@]}"
exit 1
