// The decisions behind scripts/publish.mjs, kept free of the registry, pnpm and
// npm so they can be tested: what to publish, in what order, and what must not
// be published because something it depends on did not make it.
//
// The rule they enforce: never publish a package whose workspace dependency is
// missing from the registry at the version it will ask for. npm accepts such a
// tarball without complaint, and every `npm i` of it then fails -- and since npm
// never lets a version number be reused, the broken version cannot be fixed in
// place, only superseded.
//
// Every package here is a { dir, manifest } pair; `workspace` maps every
// workspace package's name to its manifest (private ones included), and
// `registry` maps a name to the versions already on the registry.

// Every field npm installs from. devDependencies never reach a consumer.
const INSTALLED = ['dependencies', 'peerDependencies', 'optionalDependencies']

// The workspace packages a manifest pulls in when installed.
export const workspaceDeps = (manifest, workspace) => [
  ...new Set(
    INSTALLED.flatMap(field => Object.keys(manifest[field] ?? {})).filter(name =>
      workspace.has(name),
    ),
  ),
]

// Dependencies before dependents, so a failure is known before anything that
// depends on it is attempted.
export const publishOrder = packages => {
  const byName = new Map(packages.map(p => [p.manifest.name, p]))
  const sorted = []
  const seen = new Set()
  const visit = pkg => {
    if (seen.has(pkg.manifest.name)) return
    seen.add(pkg.manifest.name)
    for (const dep of workspaceDeps(pkg.manifest, byName)) visit(byName.get(dep))
    sorted.push(pkg)
  }
  packages.forEach(visit)
  return sorted
}

const isOnRegistry = (registry, name, version) => (registry.get(name) ?? []).includes(version)

// Before anything is published: every workspace dependency of every package
// about to be published must, at the version packing will write into the
// tarball, be on the registry already or be published by this run. Returns one
// line per violation; empty means go.
//
// The version is the dependency's own manifest version, because that is what
// pnpm pack turns `workspace:^` into.
export const preflight = ({ packages, workspace, registry }) => {
  const toPublish = new Set(
    packages
      .filter(({ manifest }) => !isOnRegistry(registry, manifest.name, manifest.version))
      .map(({ manifest }) => manifest.name),
  )
  const problems = []
  for (const { manifest } of packages) {
    if (!toPublish.has(manifest.name)) continue
    for (const dep of workspaceDeps(manifest, workspace)) {
      const { version } = workspace.get(dep)
      if (isOnRegistry(registry, dep, version) || toPublish.has(dep)) continue
      problems.push(
        `${manifest.name}@${manifest.version} depends on ${dep}@${version}, ` +
          'which is neither on the registry nor in this publish',
      )
    }
  }
  return problems
}

// What to do with one package, given what has happened so far. `unavailable`
// holds the names that failed or were skipped earlier in this run.
export const decide = (manifest, { published, unavailable, workspace }) => {
  if (published.includes(manifest.version)) return { action: 'already' }
  const blockers = workspaceDeps(manifest, workspace).filter(dep => unavailable.has(dep))
  return blockers.length ? { action: 'skip', blockers } : { action: 'publish' }
}

// Walk the packages in dependency order, calling `publish` for each one that
// is safe to publish. A failure does not stop the run -- packages that do not
// depend on it still go out, and a re-run picks up whatever is missing -- but
// it does stop everything downstream of it, transitively.
export const publishAll = async ({ packages, workspace, registry, publish, log }) => {
  const results = { published: [], already: [], failed: [], skipped: [] }
  const unavailable = new Set()

  for (const pkg of publishOrder(packages)) {
    const { name, version } = pkg.manifest
    const id = `${name}@${version}`
    const decision = decide(pkg.manifest, {
      published: registry.get(name) ?? [],
      unavailable,
      workspace,
    })

    if (decision.action === 'already') {
      log(`  = ${id} already published`)
      results.already.push(id)
      continue
    }

    if (decision.action === 'skip') {
      log(`  - ${id} skipped: depends on ${decision.blockers.join(', ')}, which did not publish`)
      unavailable.add(name)
      results.skipped.push(id)
      continue
    }

    try {
      await publish(pkg)
      results.published.push(id)
    } catch (error) {
      log(`  ✗ ${id} failed: ${String(error?.message ?? error).split('\n')[0]}`)
      unavailable.add(name)
      results.failed.push(id)
    }
  }

  return results
}

// A run that skipped anything is a failed run, even if every attempted publish
// worked: the release is incomplete.
export const succeeded = results => results.failed.length === 0 && results.skipped.length === 0
