#!/usr/bin/env bash
#
# Finish the first release: bootstrap-publish every package, then tag it.
#
#   bash scripts/finish-release.sh              # do it
#   bash scripts/finish-release.sh --dry-run    # say what it would do
#   bash scripts/finish-release.sh --cleanup    # retire the bootstrap machinery
#
# This exists because the first release of a brand new package cannot go out
# the normal way. release.yml authenticates over OIDC, and npm will not
# configure a trusted publisher for a package that has never been published --
# with no pending-publisher to pre-register one, the first publish has to come
# from somewhere else. bootstrap-publish.yml is that somewhere else, and this
# script drives it.
#
# What it does, in order:
#
#   1. Checks the working tree, the branch, and that the bootstrap workflow is
#      actually on main where workflow_dispatch can see it.
#   2. Dispatches bootstrap-publish.yml and waits for it, rather than firing
#      and leaving you to guess.
#   3. Verifies every package really is on the registry at the expected
#      version -- a green workflow is not proof, and a partial publish is the
#      failure worth catching.
#   4. Tags the exact commit the workflow published from, and pushes the tag.
#
# Safe to re-run. Every step checks the state it is about to create: already
# published packages are skipped by changesets, and an existing tag is left
# alone rather than moved.
#
# Nothing here can be undone by re-running it. A published version number is
# permanent -- npm does not let one be reused, even after an unpublish -- so
# the dispatch step asks before it fires.
set -euo pipefail

DRY_RUN=false
CLEANUP=false
SKIP_TAG=false
ASSUME_YES=false
REPO=""
WORKFLOW="bootstrap-publish.yml"

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=true ;;
    --cleanup) CLEANUP=true ;;
    --no-tag) SKIP_TAG=true ;;
    --yes|-y) ASSUME_YES=true ;;
    --repo) REPO="${2:?--repo needs a value}"; shift ;;
    -h|--help) sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$1" >&2; exit 2 ;;
  esac
  shift
done

info() { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
die()  { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }
would() { printf '  \033[36m→\033[0m would %s\n' "$1"; }

# ---------------------------------------------------------------- preflight

info "Preflight"

command -v gh >/dev/null || die "gh is not installed (https://cli.github.com)"
command -v node >/dev/null || die "node is not installed"
gh auth status >/dev/null 2>&1 || die "gh is not authenticated. Run: gh auth login"
ok "gh authenticated as $(gh api user --jq .login)"

if [ -z "$REPO" ]; then
  REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null) \
    || die "could not detect the repository. Pass --repo owner/name"
fi
ok "repository $REPO"

# The version every package shares. The changeset config keeps them in a fixed
# group, so core's version is the release's version.
VERSION=$(node -p "require('./packages/core/package.json').version")
TAG="v$VERSION"
ok "release version $VERSION"

# Collect the package names once; several steps below need them.
PKGS=$(for dir in packages/*/; do
  node -p "require('./${dir}package.json').private ? '' : require('./${dir}package.json').name" 2>/dev/null
done | grep -v '^$' | sort)
PKG_COUNT=$(printf '%s\n' "$PKGS" | wc -l | tr -d ' ')
ok "$PKG_COUNT publishable packages"

# ------------------------------------------------------------- 1. cleanup
#
# Handled early and then exited: retiring the bootstrap machinery is a
# different job from running it, and doing both in one pass would mean
# deleting the workflow in the same breath as using it.

if [ "$CLEANUP" = true ]; then
  info "Retiring the bootstrap machinery"

  UNPUBLISHED=""
  for pkg in $PKGS; do
    npm view "$pkg" version >/dev/null 2>&1 || UNPUBLISHED="$UNPUBLISHED $pkg"
  done
  if [ -n "$UNPUBLISHED" ]; then
    warn "still unpublished:$UNPUBLISHED"
    die "refusing to retire the bootstrap path while it is still the only way to publish"
  fi
  ok "every package is on the registry"

  # The token is the thing worth removing first: it is a long-lived publish
  # credential that trusted publishing has made redundant.
  if gh secret list --repo "$REPO" --json name --jq '.[].name' 2>/dev/null | grep -qx NPM_TOKEN; then
    if [ "$DRY_RUN" = true ]; then
      would "delete the NPM_TOKEN secret"
    else
      gh secret delete NPM_TOKEN --repo "$REPO"
      ok "NPM_TOKEN secret deleted"
    fi
  else
    ok "no NPM_TOKEN secret to delete"
  fi

  if [ -f ".github/workflows/$WORKFLOW" ]; then
    if [ "$DRY_RUN" = true ]; then
      would "delete .github/workflows/$WORKFLOW (commit it yourself)"
    else
      rm ".github/workflows/$WORKFLOW"
      ok "deleted .github/workflows/$WORKFLOW -- commit it on a branch and open a PR"
    fi
  else
    ok "bootstrap workflow already gone"
  fi

  printf '\n  Confirm each package now publishes over OIDC:\n'
  printf '    npmjs.com > package > Settings > Trusted publisher\n'
  printf '    repository %s, workflow release.yml\n' "$REPO"
  exit 0
fi

# --------------------------------------------------- 2. is anything to do?

info "1. Registry state"

TODO=""
DONE=""
for pkg in $PKGS; do
  live=$(npm view "$pkg" version 2>/dev/null || true)
  if [ -z "$live" ]; then
    TODO="$TODO $pkg"
  elif [ "$live" = "$VERSION" ]; then
    DONE="$DONE $pkg"
    ok "$pkg@$VERSION already published"
  else
    # Not fatal: changesets publishes what is missing and skips the rest. But
    # it means this is no longer the first release, so say so plainly.
    warn "$pkg is on npm at $live, not $VERSION"
    TODO="$TODO $pkg"
  fi
done

if [ -z "$TODO" ]; then
  ok "nothing to publish -- all $PKG_COUNT packages are at $VERSION"
  PUBLISH_NEEDED=false
else
  PUBLISH_NEEDED=true
  printf '  to publish:\n'
  for pkg in $TODO; do printf '      %s\n' "$pkg"; done
fi

# --------------------------------------------------------- 3. the publish

HEAD_SHA=""

if [ "$PUBLISH_NEEDED" = true ]; then
  info "2. Bootstrap publish"

  # workflow_dispatch only sees workflows that exist on the default branch.
  # Checking here turns a confusing gh error into a sentence.
  DEFAULT_BRANCH=$(gh repo view "$REPO" --json defaultBranchRef --jq .defaultBranchRef.name)
  if ! gh api "repos/$REPO/contents/.github/workflows/$WORKFLOW?ref=$DEFAULT_BRANCH" >/dev/null 2>&1; then
    die "$WORKFLOW is not on $DEFAULT_BRANCH yet -- merge the PR that adds it, then re-run"
  fi
  ok "$WORKFLOW is on $DEFAULT_BRANCH"

  if ! gh secret list --repo "$REPO" --json name --jq '.[].name' 2>/dev/null | grep -qx NPM_TOKEN; then
    die "no NPM_TOKEN secret -- the bootstrap publish authenticates with it. Set it, then re-run"
  fi
  ok "NPM_TOKEN secret present"

  if [ "$DRY_RUN" = true ]; then
    would "dispatch $WORKFLOW on $DEFAULT_BRANCH and wait for it"
  else
    # The last point at which nothing is permanent.
    if [ "$ASSUME_YES" != true ]; then
      printf '\n  \033[1mThis publishes to npm permanently.\033[0m A version number cannot be\n'
      printf '  reused once taken, even after an unpublish.\n'
      printf '  Publish %s at %s? [y/N] ' "$(printf '%s' "$TODO" | wc -w | tr -d ' ') package(s)" "$VERSION"
      read -r reply
      case "$reply" in
        y|Y|yes|YES) ;;
        *) die "aborted" ;;
      esac
    fi

    # Note the newest run id before dispatching, so the run we pick up after
    # is provably the one we started and not a leftover.
    BEFORE=$(gh run list --workflow "$WORKFLOW" --repo "$REPO" --limit 1 --json databaseId --jq '.[0].databaseId // 0')

    gh workflow run "$WORKFLOW" --repo "$REPO" --ref "$DEFAULT_BRANCH" -f confirm=publish
    ok "dispatched"

    # gh returns before the run is queryable; wait for a genuinely new id.
    RUN_ID=""
    for _ in $(seq 1 30); do
      sleep 2
      CANDIDATE=$(gh run list --workflow "$WORKFLOW" --repo "$REPO" --limit 1 --json databaseId --jq '.[0].databaseId // 0')
      if [ "$CANDIDATE" != "$BEFORE" ]; then RUN_ID="$CANDIDATE"; break; fi
    done
    [ -n "$RUN_ID" ] || die "dispatched, but no new run appeared. Check: gh run list --workflow $WORKFLOW"
    ok "run $RUN_ID started"

    printf '\n'
    # Streams progress and exits non-zero if the run fails.
    gh run watch "$RUN_ID" --repo "$REPO" --exit-status || {
      printf '\n'
      warn "the run failed. Its logs:"
      printf '    gh run view %s --repo %s --log-failed\n' "$RUN_ID" "$REPO"
      die "publish failed -- nothing tagged"
    }
    ok "workflow succeeded"

    # Tag what was actually published, not whatever main has drifted to.
    HEAD_SHA=$(gh run view "$RUN_ID" --repo "$REPO" --json headSha --jq .headSha)
    ok "published from $HEAD_SHA"
  fi
fi

# ---------------------------------------------------------- 4. verify npm

info "3. Verify the registry"

if [ "$DRY_RUN" = true ] && [ "$PUBLISH_NEEDED" = true ]; then
  would "confirm all $PKG_COUNT packages report $VERSION"
else
  MISSING=""
  for pkg in $PKGS; do
    # The registry is read-through-cache; a freshly published version can lag
    # a few seconds. Retry before calling it a failure.
    live=""
    for _ in 1 2 3 4 5; do
      live=$(npm view "$pkg" version 2>/dev/null || true)
      [ "$live" = "$VERSION" ] && break
      sleep 3
    done
    if [ "$live" = "$VERSION" ]; then
      ok "$pkg@$VERSION"
    else
      warn "$pkg reports '${live:-nothing}', expected $VERSION"
      MISSING="$MISSING $pkg"
    fi
  done
  [ -z "$MISSING" ] || die "not every package published:$MISSING -- re-run to publish the rest"
  ok "all $PKG_COUNT packages are live at $VERSION"
fi

# --------------------------------------------------------------- 5. the tag

if [ "$SKIP_TAG" = true ]; then
  info "4. Tag"
  ok "skipped (--no-tag)"
else
  info "4. Tag $TAG"

  if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
    ok "$TAG already exists locally"
  elif [ "$DRY_RUN" = true ]; then
    would "create $TAG"
  else
    # Fall back to origin's default branch head when we did not run a publish
    # this time (nothing to publish, so nothing told us a sha).
    DEFAULT_BRANCH=$(gh repo view "$REPO" --json defaultBranchRef --jq .defaultBranchRef.name)
    git fetch --quiet origin "$DEFAULT_BRANCH"
    if [ -z "$HEAD_SHA" ]; then
      HEAD_SHA=$(git rev-parse "origin/$DEFAULT_BRANCH")
    fi

    # The workflow published from a commit this clone may never have fetched.
    # Tagging it blind would fail with a bare "unknown revision"; say why.
    git cat-file -e "${HEAD_SHA}^{commit}" 2>/dev/null \
      || die "commit $HEAD_SHA is not in this clone -- git fetch origin, then re-run"
    git tag -a "$TAG" "$HEAD_SHA" -m "$TAG"
    ok "created $TAG at ${HEAD_SHA:0:7}"
  fi

  if [ "$DRY_RUN" = true ]; then
    would "push $TAG to origin"
  elif git ls-remote --exit-code --tags origin "refs/tags/$TAG" >/dev/null 2>&1; then
    ok "$TAG already on origin"
  else
    git push origin "$TAG"
    ok "pushed $TAG"
  fi
fi

# ------------------------------------------------------------- 6. what next

info "Next"

if [ "$DRY_RUN" = true ]; then
  printf '  \033[36mDry run: nothing was changed.\033[0m\n'
else
  cat <<EOS
  The packages are published and tagged. Two things retire the bootstrap path,
  and until they are done the repo is still holding a publish token:

    1. On npmjs.com, per package: Settings > Trusted publisher >
       repository $REPO, workflow release.yml
    2. bash scripts/finish-release.sh --cleanup
       (deletes the NPM_TOKEN secret and the bootstrap workflow)
EOS
fi
