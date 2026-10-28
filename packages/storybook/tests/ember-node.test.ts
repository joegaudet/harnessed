// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { emberIndexer } from '../src/ember-node'

const STORIES = `import type { Meta } from '@harnessed-ts/storybook/ember';
import Greeting from './greeting';

export default {
  title: 'Greetings/Greeting',
  render: ({ name }) => <template><Greeting @name={{name}} /></template>,
} satisfies Meta<{ name: string }>;

export const Ada = { args: { name: 'Ada' } };
export const WithClass = {
  render: () => class { <template>hi</template> },
};
`

let dir: string | undefined

afterEach(async () => {
  if (dir !== undefined) await rm(dir, { recursive: true })
  dir = undefined
})

describe('emberIndexer', () => {
  it('claims .stories.gjs and .stories.gts, and leaves other files to Storybook', () => {
    expect(emberIndexer.test.test('Greeting.stories.gts')).toBe(true)
    expect(emberIndexer.test.test('Greeting.stories.gjs')).toBe(true)
    expect(emberIndexer.test.test('Greeting.stories.ts')).toBe(false)
    expect(emberIndexer.test.test('greeting.gts')).toBe(false)
  })

  it('indexes a file with <template> tags as ordinary CSF', async () => {
    dir = await mkdtemp(join(tmpdir(), 'harnessed-indexer-'))
    const fileName = join(dir, 'Greeting.stories.gts')
    await writeFile(fileName, STORIES)

    const entries = await emberIndexer.createIndex(fileName, {
      makeTitle: title => title ?? 'untitled',
    })

    expect(entries.map(entry => [entry.title, entry.exportName])).toEqual([
      ['Greetings/Greeting', 'Ada'],
      ['Greetings/Greeting', 'WithClass'],
    ])
  })
})
