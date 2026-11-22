// TypeDoc plugin for the API reference at joegaudet.com/harnessed/api/:
//
// - Each page gets the marketing site's link-preview card and JSON-LD, which TypeDoc has no
//   option for (it writes the canonical link and sitemap itself, from hostedBaseUrl).
// - Members a class inherits from the standard library are dropped: the error classes extend
//   `Error`, so their pages would otherwise list `Error`'s members, whose lib.d.ts comments
//   also hold links TypeDoc can't resolve.
import { Converter, JSX, ReflectionKind } from 'typedoc'

const SITE = 'https://joegaudet.com/harnessed/'
const CARD = `${SITE}og-image.png`

const fromStdLib = reflection =>
  reflection.sources?.length > 0 &&
  reflection.sources.every(source => /node_modules\/typescript\/lib\//.test(source.fullFileName))

export function load(app) {
  app.converter.on(Converter.EVENT_RESOLVE_BEGIN, context => {
    for (const reflection of context.project.getReflectionsByKind(ReflectionKind.ClassMember))
      if (reflection.inheritedFrom && fromStdLib(reflection))
        context.project.removeReflection(reflection)
  })

  app.renderer.hooks.on('head.end', context => {
    const base = app.options.getValue('hostedBaseUrl')
    const url = new URL(context.page.url.replace(/(^|\/)index\.html$/, '$1'), base).href
    const title = context.page.model.isProject?.()
      ? 'harnessed API reference'
      : `${context.page.model.name} · harnessed API`
    const description = context.page.model.comment?.summary
      .map(part => part.text)
      .join('')
      .split('\n\n')[0]
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: title,
      url,
      isPartOf: { '@type': 'WebSite', name: 'harnessed', url: SITE },
      about: {
        '@type': 'SoftwareSourceCode',
        name: 'harnessed',
        codeRepository: 'https://github.com/joegaudet/harnessed',
        programmingLanguage: 'TypeScript',
      },
      author: { '@type': 'Person', name: 'Joe Gaudet', url: 'https://joegaudet.com/' },
    }
    return JSX.createElement(
      JSX.Fragment,
      null,
      JSX.createElement('meta', { property: 'og:type', content: 'article' }),
      JSX.createElement('meta', { property: 'og:site_name', content: 'harnessed' }),
      JSX.createElement('meta', { property: 'og:title', content: title }),
      description &&
        JSX.createElement('meta', { property: 'og:description', content: description }),
      JSX.createElement('meta', { property: 'og:url', content: url }),
      JSX.createElement('meta', { property: 'og:image', content: CARD }),
      JSX.createElement('meta', { property: 'og:image:width', content: '1200' }),
      JSX.createElement('meta', { property: 'og:image:height', content: '630' }),
      JSX.createElement('meta', { name: 'twitter:card', content: 'summary_large_image' }),
      JSX.createElement('link', {
        rel: 'alternate',
        type: 'text/plain',
        href: `${SITE}llms.txt`,
        title: 'llms.txt',
      }),
      JSX.createElement(
        'script',
        { type: 'application/ld+json' },
        JSX.createElement(JSX.Raw, { html: JSON.stringify(ld).replaceAll('<', '\\u003c') }),
      ),
    )
  })
}
