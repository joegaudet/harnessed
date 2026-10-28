import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { describe, expect, it } from 'vitest'
import { filesOnDisk } from '../src/inject'

describe('filesOnDisk', () => {
  it('writes each file under its own name, bytes and all, in order', async () => {
    const paths = await filesOnDisk([
      new File(['hello'], 'a.txt'),
      new File(['second'], 'a.txt'),
      new File(['x'], '../escape.txt'),
    ])
    expect(paths.map(path => basename(path))).toEqual(['a.txt', 'a.txt', 'escape.txt'])
    expect(new Set(paths).size).toBe(3)
    expect(paths.map(path => readFileSync(path, 'utf8'))).toEqual(['hello', 'second', 'x'])
  })
})
