import { readFile } from 'node:fs/promises'
import { Preprocessor } from 'content-tag'
import { loadCsf } from 'storybook/internal/csf-tools'
import type { Indexer } from 'storybook/internal/types'

/**
 * Indexes `.stories.gjs` and `.stories.gts` files, which Storybook's own CSF
 * indexer cannot parse: their `<template>` tags are not JavaScript. Each file is
 * read with the tags compiled away, as `content-tag` does for Embroider, and
 * indexed as ordinary CSF.
 *
 * ```ts
 * // .storybook/main.ts
 * import { emberIndexer } from '@harnessed-ts/storybook/ember/node'
 * export default {
 *   stories: ['../stories/*.stories.@(ts|gts)'],
 *   experimental_indexers: existing => [emberIndexer, ...(existing ?? [])],
 * }
 * ```
 */
export const emberIndexer: Indexer = {
  test: /\.stories\.g[jt]s$/,
  async createIndex(fileName, options) {
    const source = await readFile(fileName, 'utf-8')
    const { code } = new Preprocessor().process(source, { filename: fileName })
    return loadCsf(code, { ...options, fileName }).parse().indexInputs
  },
}
