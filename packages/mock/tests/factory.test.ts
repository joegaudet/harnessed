import { describe, expect, it } from 'vitest'
import { defineFactory, oneOf, seq } from '../src'

interface User {
  id: string
  email: string
  role: 'member' | 'admin'
  tags: string[]
  color: string
}

describe('defineFactory', () => {
  const users = defineFactory<User, 'admin'>(
    {
      id: seq(String),
      email: seq(n => `user${n}@example.com`),
      role: 'member',
      tags: [],
      color: oneOf('red', 'blue'),
    },
    { traits: { admin: { role: 'admin' } } },
  )

  it('builds deterministic objects with overrides, traits and lists', () => {
    users.reset()
    expect(users.build()).toEqual({
      id: '1',
      email: 'user1@example.com',
      role: 'member',
      tags: [],
      color: 'red',
    })
    expect(users.with('admin').build({ email: 'root@example.com' })).toMatchObject({
      id: '2',
      role: 'admin',
      email: 'root@example.com',
      color: 'blue',
    })
    expect(
      users.buildList(2, index => ({ tags: [`t${index}`] })).map(user => [user.id, user.tags]),
    ).toEqual([
      ['3', ['t0']],
      ['4', ['t1']],
    ])
  })

  it('copies object defaults so builds do not share them', () => {
    const a = users.build()
    a.tags.push('x')
    expect(users.build().tags).toEqual([])
  })
})
