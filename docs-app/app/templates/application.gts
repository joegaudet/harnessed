import { PageNav } from 'kolay/components'

const LOGO = `${import.meta.env.BASE_URL}logo.svg`

/** On phones the contents start collapsed, so the page isn't pushed below the fold. */
const WIDE = typeof matchMedia === 'function' && matchMedia('(min-width: 861px)').matches

const TITLES: Record<string, string> = {
  api: 'API reference',
  'testing library': 'Testing Library',
  'node test': 'node:test',
  'webdriverio': 'WebdriverIO',
  'testcafe': 'TestCafe',
  'vitest browser': 'Vitest browser mode',
  'mocking apis': 'Mocking APIs',
  'create api stubs': 'Migrating from createApiStubs',
  'eslint plugin': 'ESLint plugin',
  'cross driver guarantees': 'Cross-driver guarantees',
  'storybook and bdd': 'Storybook & BDD',
}

/** "custom-controls" → "Custom controls" */
function title(name: string): string {
  const key = name.replace(/\.md$/, '').replaceAll('-', ' ')
  if (TITLES[key]) return TITLES[key]
  const words = name.replace(/\.md$/, '').replaceAll('-', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

<template>
  <header class="guide-header">
    <a class="guide-brand" href="https://joegaudet.com/harnessed/">
      <img src={{LOGO}} alt="" width="26" height="26" />
      <strong>harnessed</strong>
      <span class="guide-tag">Guide</span>
    </a>
    <nav aria-label="Site">
      <a href="https://joegaudet.com/harnessed/">Home</a>
      <a href="https://github.com/joegaudet/harnessed">GitHub</a>
    </nav>
  </header>

  <div class="guide-layout">
    <details class="guide-sidebar" open={{WIDE}}>
      <summary>Contents</summary>
      <PageNav>
        <:page as |x|>
          <x.Link>{{title x.page.name}}</x.Link>
        </:page>
        <:collection as |x|>
          {{title x.collection.name}}
        </:collection>
      </PageNav>
    </details>

    <main class="guide-main">
      {{outlet}}
    </main>
  </div>
</template>
