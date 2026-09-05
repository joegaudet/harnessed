#!/usr/bin/env bash
#
# Configure everything a release needs, once per repository.
#
#   bash scripts/setup-release.sh              # do it
#   bash scripts/setup-release.sh --dry-run    # say what it would do
#
# Two things, both of which have already bitten this repo:
#
#   1. Trusted publishing. Releases authenticate to npm over OIDC, not with a
#      stored token, so every package must name this repository and
#      .github/workflows/release.yml as a trusted publisher on npmjs.com.
#      This script reports which packages still need it; the setting itself
#      lives in the npm UI and cannot be scripted.
#   2. "Allow GitHub Actions to create and approve pull requests". Changesets
#      opens a version PR before publishing, and the first release attempt died
#      on exactly this -- the publish step was never reached.
#
# Note the bootstrap hole: npm will not let you configure a trusted publisher
# for a package that has never been published, and has no "pending publisher"
# to pre-register one. The first release of a brand new package therefore has
# to go out with a token or an OTP; every release after it is tokenless.
#
# Safe to re-run. Changes no npm state.
set -euo pipefail

DRY_RUN=false
REPO=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=true ;;
    --repo) REPO="${2:?--repo needs a value}"; shift ;;
    -h|--help) sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
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

# ------------------------------------------------ 1. trusted publishing

info "1. Trusted publishing"

# A leftover NPM_TOKEN is not merely unused now -- it is a long-lived publish
# credential sitting in the repo for no reason.
if gh secret list --repo "$REPO" --json name --jq '.[].name' 2>/dev/null | grep -qx NPM_TOKEN; then
  warn "an NPM_TOKEN secret still exists but is no longer used by release.yml"
  warn "delete it: gh secret delete NPM_TOKEN --repo $REPO"
else
  ok "no stale NPM_TOKEN secret"
fi

# Trusted publishing cannot be configured for a package that does not exist,
# so say plainly which ones still need a bootstrap publish.
UNPUBLISHED=""
for dir in packages/*/; do
  pkg=$(node -p "require('./${dir}package.json').name" 2>/dev/null) || continue
  if npm view "$pkg" version >/dev/null 2>&1; then
    ok "$pkg is on npm -- confirm its trusted publisher in Settings > Trusted publisher"
  else
    UNPUBLISHED="$UNPUBLISHED $pkg"
  fi
done

if [ -n "$UNPUBLISHED" ]; then
  warn "never published, so a trusted publisher cannot be configured yet:"
  for pkg in $UNPUBLISHED; do printf '      %s\n' "$pkg"; done
  cat <<'EOS'
      Bootstrap each one once, then the workflow takes over:
        npm publish --access public --otp=<code>     (from the package dir)
      or publish with a granular token that has "Bypass 2FA" enabled.
      Then on npmjs.com, per package: Settings > Trusted publisher >
        repository: this repo, workflow: release.yml
EOS
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
