import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { acquireLock } from './build-lock.mjs'

let dir
let lock
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'build-lock-'))
  lock = join(dir, 'nested', '.build.lock')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

/** A pid that belonged to a process which has since exited. */
function deadPid() {
  return spawnSync(process.execPath, ['-e', '']).pid
}

/** Leaves a lock file behind, as another process would. */
function plant(contents) {
  mkdirSync(dirname(lock), { recursive: true })
  writeFileSync(lock, typeof contents === 'string' ? contents : JSON.stringify(contents))
}

const fast = { pollMs: 10 }

test('takes a free lock, records the holder, and releases it', async () => {
  const release = await acquireLock(lock, fast)
  assert.equal(JSON.parse(readFileSync(lock, 'utf8')).pid, process.pid)
  release()
  assert.equal(existsSync(lock), false)
})

test('a second taker waits until the first releases', async () => {
  const releaseFirst = await acquireLock(lock, fast)
  let second = false
  const taking = acquireLock(lock, fast).then(release => {
    second = true
    return release
  })
  await new Promise(resolve => setTimeout(resolve, 200))
  assert.equal(second, false, 'took a lock that was held')
  releaseFirst()
  const releaseSecond = await taking
  assert.equal(second, true)
  releaseSecond()
})

test('breaks a lock whose holder has exited', async () => {
  plant({ pid: deadPid(), token: 'stale', at: Date.now() })
  const release = await acquireLock(lock, { ...fast, timeoutMs: 2000 })
  assert.equal(JSON.parse(readFileSync(lock, 'utf8')).pid, process.pid)
  release()
})

test('breaks a lock held for longer than staleMs, even by a live process', async () => {
  plant({ pid: process.ppid, token: 'old', at: Date.now() - 60_000 })
  const release = await acquireLock(lock, { ...fast, staleMs: 30_000, timeoutMs: 2000 })
  assert.equal(JSON.parse(readFileSync(lock, 'utf8')).pid, process.pid)
  release()
})

test('breaks a lock file that is not a lock record', async () => {
  plant('garbage')
  const release = await acquireLock(lock, { ...fast, timeoutMs: 2000 })
  release()
})

test('gives up after timeoutMs, naming the holder', async () => {
  plant({ pid: process.ppid, token: 'live', at: Date.now() })
  await assert.rejects(acquireLock(lock, { ...fast, timeoutMs: 100 }), {
    message: new RegExp(`pid ${process.ppid}`),
  })
})

test('releasing does not remove a lock someone else now holds', async () => {
  const release = await acquireLock(lock, fast)
  const theirs = JSON.stringify({ pid: process.ppid, token: 'theirs', at: Date.now() })
  plant(theirs)
  release()
  assert.equal(readFileSync(lock, 'utf8'), theirs)
})
