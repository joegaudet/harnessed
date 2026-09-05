#!/usr/bin/env bash
#
# Configure everything a release needs, once per repository.
#
#   bash scripts/setup-release.sh              # do it
#   bash scripts/setup-release.sh --dry-run    # say what it would do
#   bash scripts/setup-release.sh --no-token   # settings only, no prompt
#
# Reads the token from $NPM_TOKEN when set, so it can run unattended.
#
# Two things, both of which have already bitten this repo:
#
#   1. The NPM_TOKEN secret. Without it the release workflow reaches npm and is
#      turned away.
#   2. "Allow GitHub Actions to create and approve pull requests". Changesets
#      opens a version PR before publishing, and the first release attempt died
#      on exactly this — the publish step was never reached.
#
# Safe to re-run. The token is never printed, never passed as an argument (where
# it would show up in the process list), and never written to disk.
set -euo pipefail

DRY_RUN=false
SKIP_TOKEN=false
REPO=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=true ;;
    --no-token) SKIP_TOKEN=true ;;
    --repo) REPO="${2:?--repo needs a value}"; shift ;;
    -h|--help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$1" >&2; exit 2 ;;
  esac
  shift
done

info() { printf '\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
die()  { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }
would() { printf '  \033[36m→\033[0m would %s\n' "$1"; }

# ---------------------------------------------------------------- preflight

info "Preflight"

command -v gh >/dev/null || die "gh is not installed (https://cli.github.com)"
gh auth status >/dev/null 2>&1 || die "gh is not authenticated. Run: gh auth login"
ok "gh authenticated as $(gh api user --jq .login)"

if [ -z "$REPO" ]; then
  REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null) \
    || die "could not detect the repository. Pass --repo owner/name"
fi
ok "repository $REPO"

# Writing repo settings needs more than the default read scopes.
if ! gh api "repos/$REPO/actions/permissions/workflow" >/dev/null 2>&1; then
  die "cannot read Actions settings for $REPO — you need admin on it, and gh needs the 'repo' scope (gh auth refresh -s repo)"
fi

# ------------------------------------------------------- 1. the npm token

info "1. NPM_TOKEN secret"

if gh secret list --repo "$REPO" --json name --jq '.[].name' 2>/dev/null | grep -qx NPM_TOKEN; then
  ok "already set (delete it with: gh secret delete NPM_TOKEN --repo $REPO)"
elif [ "$SKIP_TOKEN" = true ]; then
  warn "skipped (--no-token). A release cannot publish until this is set."
elif [ "$DRY_RUN" = true ]; then
  would "prompt for an npm token and store it as the NPM_TOKEN secret"
else
  TOKEN="${NPM_TOKEN:-}"
  if [ -z "$TOKEN" ]; then
    cat <<'EOS'
  Needs an npm token with publish rights for the @harnessed-ts scope. Either:
    - npmjs.com → Access Tokens → Generate → Granular or Automation, or
    - npm token create        (classic token, needs `npm login` first)
  It is read silently and never echoed.
EOS
    printf '  npm token: '
    read -rs TOKEN
    printf '\n'
  else
    ok "using the NPM_TOKEN already in the environment"
  fi
  [ -n "$TOKEN" ] || die "no token given"

  # Piped, not passed as an argument: arguments are visible to every other
  # process on the machine.
  printf '%s' "$TOKEN" | gh secret set NPM_TOKEN --repo "$REPO"
  unset TOKEN
  ok "NPM_TOKEN stored"
fi

# --------------------------------- 2. let Actions open the version PR

info "2. Allow Actions to create pull requests"

CURRENT=$(gh api "repos/$REPO/actions/permissions/workflow" --jq .can_approve_pull_request_reviews)
DEFAULT_PERMS=$(gh api "repos/$REPO/actions/permissions/workflow" --jq .default_workflow_permissions)

if [ "$CURRENT" = "true" ]; then
  ok "already allowed"
elif [ "$DRY_RUN" = true ]; then
  would "set can_approve_pull_request_reviews=true (currently $CURRENT)"
else
  # Send the existing default back unchanged; this endpoint replaces the whole
  # object, and the workflows set their own job-level permissions anyway.
  gh api --method PUT "repos/$REPO/actions/permissions/workflow" \
    -f "default_workflow_permissions=$DEFAULT_PERMS" \
    -F can_approve_pull_request_reviews=true >/dev/null
  ok "enabled (default_workflow_permissions left as '$DEFAULT_PERMS')"
fi

# ------------------------------------------------------------- 3. report

info "Release readiness"

PENDING=$(find .changeset -name '*.md' ! -name 'README.md' 2>/dev/null | wc -l | tr -d ' ')
if [ "$PENDING" = "0" ]; then
  ok "no changesets pending — merging to main publishes the current versions directly"
else
  ok "$PENDING changeset(s) pending — merging to main opens a version PR; merge that to publish"
fi

if [ "$DRY_RUN" = true ]; then
  printf '\n  \033[36mDry run: nothing was changed.\033[0m\n'
else
  printf '\n  \033[32mReady. Merge to main and the release workflow takes it from there.\033[0m\n'
fi
