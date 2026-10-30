import Route from '@ember/routing/route'
import rehypeShikiFromHighlighter from '@shikijs/rehype/core'
import { setupKolay } from 'kolay/setup'
import type { Manifest } from 'kolay'
import { highlighter } from '../highlight.ts'

export default class ApplicationRoute extends Route {
  async model(): Promise<{ manifest: Manifest }> {
    const shiki = await highlighter()

    const manifest = await setupKolay(this, {
      modules: {
        '@harnessed-ts/core': () => import('@harnessed-ts/core'),
      },
      rehypePlugins: [
        [
          rehypeShikiFromHighlighter,
          shiki,
          { themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: 'light-dark()' },
        ],
      ],
    })

    return { manifest }
  }
}
