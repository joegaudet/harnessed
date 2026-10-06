import { randomUUID } from 'node:crypto'
import { linkSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

/**
 * The one lock every build of this app takes. Each `vite build` (and Vitest's
 * dev server) runs Embroider's compat prebuild, which forks `ember build` into
 * the fixed `tmp/compat-prebuild` and shares `node_modules/.embroider`, so two
 * builds at once corrupt each other whatever `--outDir` they are given.
 */
export const BUILD_LOCK = new URL('../tmp/.build.lock', import.meta.url).pathname

/**
 * Takes the lock at `path`, waiting while another live process holds it, and
 * resolves with the function that releases it.
 *
 * The lock is a file holding `{ pid, token, at }`. It is written beside the
 * path and hard-linked into place, which is atomic and fails if the path
 * exists, so a holder's record is complete from the moment it appears. A lock
 * is stale, and is broken, when its holder has exited, when it is older than
 * `staleMs`, or when it is not a lock record at all.
 */
export async function acquireLock(
  path,
  { pollMs = 200, timeoutMs = 10 * 60_000, staleMs = 10 * 60_000 } = {},
) {
  mkdirSync(dirname(path), { recursive: true })
  const token = randomUUID()
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (tryCreate(path, token)) return () => release(path, token)
    const holder = readRecord(path)
    if (holder && isStale(holder, staleMs)) breakLock(path, holder)
    else if (Date.now() >= deadline) {
      throw new Error(
        `timed out after ${timeoutMs}ms waiting for ${path}, held by ${describe(holder)}; ` +
          'delete it if that process is gone',
      )
    } else await sleep(pollMs)
  }
}

function tryCreate(path, token) {
  const draft = `${path}.${token}`
  writeFileSync(draft, JSON.stringify({ pid: process.pid, token, at: Date.now() }))
  try {
    linkSync(draft, path)
    return true
  } catch (error) {
    if (error.code === 'EEXIST') return false
    throw error
  } finally {
    unlinkSync(draft)
  }
}

/** The lock's record; `{ invalid: true }` if it is not one; null if there is no lock. */
function readRecord(path) {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return null
    throw error
  }
  try {
    const record = JSON.parse(text)
    if (Number.isInteger(record?.pid) && record.pid > 0 && typeof record.token === 'string') {
      return record
    }
  } catch {
    // Falls through: not a record.
  }
  return { invalid: true, text }
}

function isStale(holder, staleMs) {
  return holder.invalid || !isAlive(holder.pid) || Date.now() - holder.at > staleMs
}

function isAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

/**
 * Moves the stale lock aside first, so of several waiters breaking it only one
 * succeeds. If what it moved is no longer the stale record (another waiter
 * broke it and a new holder took the lock in between), it is put back.
 */
function breakLock(path, stale) {
  const aside = `${path}.${randomUUID()}.stale`
  try {
    renameSync(path, aside)
  } catch (error) {
    if (error.code === 'ENOENT') return
    throw error
  }
  const moved = readRecord(aside)
  const same = stale.invalid
    ? moved?.invalid && moved.text === stale.text
    : moved?.token === stale.token
  if (!same) {
    try {
      linkSync(aside, path)
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
    }
  }
  unlinkSync(aside)
}

function release(path, token) {
  if (readRecord(path)?.token === token) unlinkSync(path)
}

function describe(holder) {
  if (!holder) return 'nobody'
  if (holder.invalid) return 'an unreadable record'
  return `pid ${holder.pid} since ${new Date(holder.at).toISOString()}`
}
