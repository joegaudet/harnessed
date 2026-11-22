// Writes docs/api/llms-full.txt: the hand-written llms.txt, then the whole API reference as
// Markdown (TypeDoc's markdown output in docs/api-md), so an agent gets both in one fetch.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../', import.meta.url).pathname
const md = join(root, 'docs/api-md')

const pages = readdirSync(md, { recursive: true })
  .filter(file => file.endsWith('.md') && file !== 'README.md')
  .sort()
  .map(file =>
    readFileSync(join(md, file), 'utf8')
      // Links between the Markdown pages mean nothing once they are joined into one file.
      .replace(/\[([^\]]+)\]\((?!https?:)[^)]*\)/g, '$1')
      .trim(),
  )

writeFileSync(
  join(root, 'docs/api/llms-full.txt'),
  `${readFileSync(join(root, 'docs/site/llms.txt'), 'utf8')}\n## API reference\n\nThe same reference as HTML: https://joegaudet.com/harnessed/api/\n\n${pages.join('\n\n---\n\n')}\n`,
)
