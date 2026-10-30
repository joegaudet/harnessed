import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'

let instance: Promise<HighlighterCore> | undefined

/** One Shiki instance for the pages and the example frames. */
export function highlighter(): Promise<HighlighterCore> {
  return (instance ??= createHighlighterCore({
    themes: [import('shiki/themes/github-light.mjs'), import('shiki/themes/github-dark.mjs')],
    langs: [
      import('shiki/langs/typescript.mjs'),
      import('shiki/langs/tsx.mjs'),
      import('shiki/langs/javascript.mjs'),
      import('shiki/langs/glimmer-ts.mjs'),
      import('shiki/langs/glimmer-js.mjs'),
      import('shiki/langs/handlebars.mjs'),
      import('shiki/langs/css.mjs'),
      import('shiki/langs/bash.mjs'),
      import('shiki/langs/json.mjs'),
      import('shiki/langs/jsonc.mjs'),
      import('shiki/langs/toml.mjs'),
    ],
    engine: createOnigurumaEngine(() => import('shiki/wasm')),
  }))
}

export async function highlight(code: string, lang = 'glimmer-ts'): Promise<string> {
  return (await highlighter()).codeToHtml(code.trimEnd(), {
    lang,
    themes: { light: 'github-light', dark: 'github-dark' },
    defaultColor: 'light-dark()',
  })
}
