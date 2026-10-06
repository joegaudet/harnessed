#!/usr/bin/env node
//
// Publish every package that is not already on the registry.
//
//   node scripts/publish.mjs             # publish what is missing
//   node scripts/publish.mjs --dry-run   # pack and validate, publish nothing
//
// This replaces `changeset publish`, which cannot publish this repository
// correctly. Changesets picks its publish tool from the workspace it finds:
//
//   if (packageManager === "pnpm") return pnpm_exports;
//
// -- and pnpm publish supports neither OIDC trusted publishing
// (https://github.com/pnpm/pnpm/issues/9812) nor provenance. Changesets never
// passes --provenance either; it relies on npm reading NPM_CONFIG_PROVENANCE,
// which pnpm ignores. 0.2.0 shipped unsigned for exactly that reason, and an
// OIDC release would not have shipped at all.
//
// Neither tool can do the whole job alone, so each does the half it is good at:
//
//   pnpm pack     resolves "workspace:^" to a real version range. npm has no
//                 idea what the workspace protocol is and would publish the
//                 literal string, breaking every install.
//   npm publish   speaks OIDC and generates provenance.
//
// Everything else changesets does for us -- versioning, changelogs, the fixed
// group -- is untouched. Only the publish step moves.
//
// Packages publish in dependency order. Before the first publish, a preflight
// refuses the whole run if any package would depend on a workspace version that
// is neither on the registry nor part of this publish. During the run, a
// package whose workspace dependency failed (or was itself skipped) is skipped
// and reported, never published, and the run exits non-zero. The decisions
// live in ./publish-plan.mjs, which is unit-tested.
//
// Prints "New tag: name@version" per publish, the line changesets/action looks
// for when it creates GitHub releases.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { preflight, publishAll, succeeded } from './publish-plan.mjs'

const DRY_RUN = process.argv.includes('--dry-run')
const REGISTRY = 'https://registry.npmjs.org'
const PACKAGES_DIR = 'packages'

// Provenance needs a CI provider with an OIDC token. Asking for it on a laptop
// fails with a bare EUSAGE, so only request it where it can work -- and say so
// when it is skipped, rather than quietly shipping something unsigned.
const inCI = process.env.GITHUB_ACTIONS === 'true'

const log = msg => process.stdout.write(`${msg}\n`)
const read = dir => JSON.parse(readFileSync(join(PACKAGES_DIR, dir, 'package.json'), 'utf8'))

// Every workspace package, private ones included: a public package that
// depended on a private one would publish a dependency nobody can install, and
// the preflight below has to be able to see that.
const workspacePackages = readdirSync(PACKAGES_DIR).map(dir => ({ dir, manifest: read(dir) }))
const workspace = new Map(workspacePackages.map(({ manifest }) => [manifest.name, manifest]))
const packages = workspacePackages.filter(({ manifest }) => !manifest.private)

// A 404 means "never published", the normal case for a new package. It must
// not be mistaken for an error.
const publishedVersions = async name => {
  const res = await fetch(`${REGISTRY}/${name.replace('/', '%2f')}`)
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`registry returned ${res.status} for ${name}`)
  return Object.keys((await res.json()).versions ?? {})
}

log(`Publishing from ${PACKAGES_DIR}/ (${packages.length} public packages)`)
log(inCI ? '  provenance: enabled (CI)' : '  ! not running in CI: provenance will be skipped')
if (DRY_RUN) log('  dry run: packing and validating, publishing nothing')

// Ask the registry about every package once, up front: the preflight needs
// the whole picture before the first publish, not one package at a time.
const registry = new Map()
for (const name of workspace.keys()) registry.set(name, await publishedVersions(name))

// Refuse to start a release that cannot finish. A dependency that is neither
// on the registry nor about to be published would leave its dependents
// pointing at a version that does not exist, and npm never lets a version
// number be reused to fix that.
const problems = preflight({ packages, workspace, registry })
if (problems.length) {
  log('\nNot publishing anything:')
  for (const problem of problems) log(`  ✗ ${problem}`)
  process.exit(1)
}

const staging = mkdtempSync(join(tmpdir(), 'harnessed-publish-'))

const publish = pkg => {
  const { name, version } = pkg.manifest

  // pnpm writes the tarball and reports its path on the last line.
  const packed = execFileSync('pnpm', ['pack', '--pack-destination', staging], {
    cwd: join(PACKAGES_DIR, pkg.dir),
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .pop()
    .trim()

  // Guard the rewrite rather than trust it: publishing a literal
  // "workspace:^" would break every install, and it is invisible until
  // someone tries to install the result.
  const manifest = JSON.parse(
    execFileSync('tar', ['-xzOf', packed, 'package/package.json'], { encoding: 'utf8' }),
  )
  const unresolved = Object.entries({
    ...manifest.dependencies,
    ...manifest.peerDependencies,
  }).filter(([, range]) => String(range).startsWith('workspace:'))

  if (unresolved.length) {
    throw new Error(
      `workspace protocol survived packing: ${unresolved.map(([n, r]) => `${n}@${r}`).join(', ')}`,
    )
  }

  const args = ['publish', packed, '--access', 'public']
  if (inCI) args.push('--provenance')
  if (DRY_RUN) args.push('--dry-run')

  // npm refuses to publish a prerelease without an explicit tag, rather
  // than guess that 0.3.0-next.0 should not become "latest". Changesets
  // pre mode produces exactly these versions, so name the tag after the
  // prerelease identifier: 0.3.0-next.0 publishes under "next".
  const prerelease = version.includes('-') ? version.split('-')[1].split('.')[0] : null
  if (prerelease) args.push('--tag', prerelease)

  execFileSync('npm', args, { stdio: 'inherit' })

  if (DRY_RUN) {
    log(`  → would publish ${name}@${version}`)
  } else {
    log(`  ✓ ${name}@${version}`)
    // The line changesets/action parses to open a GitHub release.
    log(`New tag: ${name}@${version}`)
  }
}

// One package failing does not strand the ones that do not depend on it, and a
// re-run picks up whatever is still missing. Anything that does depend on it
// -- directly or through another package -- is skipped, never published
// against a dependency that is not there.
let results
try {
  results = await publishAll({ packages, workspace, registry, publish, log })
} finally {
  rmSync(staging, { recursive: true, force: true })
}

const verb = DRY_RUN ? 'would publish' : 'published'
log(
  `\n${results.published.length} ${verb}, ${results.already.length} already up to date, ` +
    `${results.failed.length} failed, ${results.skipped.length} skipped`,
)
if (results.failed.length) log(`failed: ${results.failed.join(', ')}`)
if (results.skipped.length) log(`skipped (a dependency failed): ${results.skipped.join(', ')}`)

if (!succeeded(results)) process.exit(1)
