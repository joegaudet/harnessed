// Turns one environment's raw footage and step timeline into docs/media/<env>.gif:
// compose/index.html lays out each frame (footage, header, the demo's source with
// the current step lit), Playwright screenshots it, ffmpeg makes the GIF.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'
import { CYPRESS_WINDOW, MARK_PX, VIEWPORT } from '../src/constants.mjs'

const APP = new URL('..', import.meta.url)
const REPO = new URL('../../', APP)
/** The GIF's frame rate. */
export const FPS = 10
/** Footage kept before the first step, and after the demo resolves. */
const LEAD_MS = 600
const HOLD_MS = 1600
/**
 * How far ahead of a frame a step may light up. A step's time and a frame's are
 * each rounded to the footage's own frames; erring early keeps the code panel
 * from ever trailing the footage.
 */
const LOOKAHEAD_MS = 50
/** The size of compose/index.html's page, and so of every GIF. */
const PAGE = { width: 960, height: 540 }
/** The footage box in compose/index.html, less a margin. */
const BOX = { width: 536, height: 422 }

export const ENVIRONMENTS = {
  rtl: {
    title: ['React Testing Library', 'React'],
    driver: '@harnessed-ts/dom · Vitest + jsdom',
    caption:
      'jsdom has no screen, so this is a replay: the DOM jsdom rendered, snapshotted as it changed and redrawn in a browser.',
  },
  'playwright-react': {
    title: ['Playwright', 'React'],
    driver: '@harnessed-ts/playwright · @playwright/test',
    caption: 'Playwright recordVideo of the React fixture, slowMo 120 ms.',
  },
  'playwright-ember': {
    title: ['Playwright', 'Ember'],
    driver: '@harnessed-ts/playwright · @playwright/test',
    caption: 'Playwright recordVideo of the Glimmer copy of the fixture, slowMo 120 ms.',
  },
  'cypress-react': {
    title: ['Cypress', 'React'],
    driver: '@harnessed-ts/cypress · cy.harnessEnv',
    caption:
      "Cypress's own video of the React fixture: the command log lists every harness action.",
  },
  'cypress-ember': {
    title: ['Cypress', 'Ember'],
    driver: '@harnessed-ts/cypress · cy.harnessEnv',
    caption:
      "Cypress's own video of the Glimmer copy of the fixture: the command log lists every harness action.",
  },
}

const path = url => fileURLToPath(url)

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' })
}

function probe(file) {
  const out = execFileSync('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height:format=duration',
    '-of',
    'json',
    file,
  ])
  const { streams, format } = JSON.parse(out.toString())
  return { width: streams[0].width, height: streams[0].height, duration: Number(format.duration) }
}

/** The demo function as it is in src/demo.ts, and the lines each step covers. */
export function demoSource() {
  const lines = readFileSync(new URL('src/demo.ts', APP), 'utf8').split('\n')
  const start = lines.findIndex(line => line.startsWith('export async function demo('))
  const end = lines.findIndex((line, i) => i > start && line === '}')
  const code = lines.slice(start, end + 1)
  const blocks = []
  code.forEach((line, i) => {
    const step = /^\s*await step\('([^']*)'\)/.exec(line)
    if (step) blocks.push({ label: step[1], start: i, end: i })
    else if (blocks.length > 0 && line.trim() !== '' && line !== '}') blocks.at(-1).end = i
  })
  return { code, blocks }
}

/** Extracts the footage between `from` and `to` seconds as numbered PNGs. */
function extractFrames(env, footage, from, to) {
  const dir = new URL(`raw/${env}/frames/`, APP)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const { width, height } = probe(footage)
  const filters = [`fps=${FPS}`]
  let size = VIEWPORT
  if (env.startsWith('cypress')) {
    // The whole runner, command log and app, less the sync mark's strip at the bottom.
    const scale = width / CYPRESS_WINDOW.width
    const cropHeight = Math.round(height - MARK_PX * scale)
    filters.push(`crop=${width}:${cropHeight}:0:0`)
    const fit = Math.min(BOX.width / width, BOX.height / cropHeight)
    size = { width: Math.round(width * fit), height: Math.round(cropHeight * fit) }
  }
  filters.push(`scale=${size.width}:${size.height}:flags=lanczos`)
  ffmpeg([
    '-ss',
    String(from),
    '-i',
    footage,
    '-t',
    String(to - from),
    '-vf',
    filters.join(','),
    // A path, not a URL: `%04d` is ffmpeg's, and a URL would decode it.
    join(path(dir), '%04d.png'),
  ])
  return { dir: pathToFileURL(path(dir)).href + '/', count: readdirSync(dir).length, ...size }
}

export async function compose(env) {
  const raw = new URL(`raw/${env}/`, APP)
  const timeline = JSON.parse(readFileSync(new URL('timeline.json', raw), 'utf8'))
  const { code, blocks } = demoSource()
  if (blocks.length !== timeline.steps.length) {
    throw new Error(`${env}: ${timeline.steps.length} steps recorded, ${blocks.length} in demo()`)
  }
  timeline.steps.forEach((step, i) => {
    if (step.label !== blocks[i].label) {
      throw new Error(`${env}: step ${i} is "${step.label}" but demo() says "${blocks[i].label}"`)
    }
  })

  const from = Math.max(0, timeline.steps[0].at - LEAD_MS) / 1000
  let to = (timeline.end + HOLD_MS) / 1000
  let footage
  if (env === 'rtl') {
    const snapshots = JSON.parse(readFileSync(new URL('snapshots.json', raw), 'utf8'))
    footage = { kind: 'dom', snapshots, ...VIEWPORT }
  } else {
    const file = path(new URL(env.startsWith('cypress') ? 'footage.mp4' : 'footage.webm', raw))
    to = Math.min(to, probe(file).duration - 0.05)
    footage = { kind: 'frames', ...extractFrames(env, file, from, to) }
  }
  // ffmpeg can come up a frame short of the arithmetic; never ask for one it skipped.
  const count = Math.min(Math.floor((to - from) * FPS), footage.count ?? Infinity)

  const out = new URL('composite/', raw)
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })

  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ viewport: PAGE })
    await page.goto(pathToFileURL(path(new URL('compose/index.html', APP))).href)
    await page.evaluate(cfg => window.setup(cfg), {
      ...ENVIRONMENTS[env],
      code,
      blocks,
      footage,
    })
    for (let index = 0; index < count; index++) {
      const t = from * 1000 + (index * 1000) / FPS
      let active = -1
      timeline.steps.forEach((step, i) => {
        if (step.at <= t + LOOKAHEAD_MS) active = i
      })
      const finished = t >= timeline.end
      await page.evaluate(args => window.frame(args), { index, t, active, finished })
      await page.screenshot({
        path: path(new URL(`${String(index + 1).padStart(4, '0')}.png`, out)),
      })
    }
  } finally {
    await browser.close()
  }

  const media = new URL('docs/media/', REPO)
  mkdirSync(media, { recursive: true })
  const gif = path(new URL(`${env}.gif`, media))
  const palette = path(new URL('palette.png', raw))
  const frames = ['-framerate', String(FPS), '-i', join(path(out), '%04d.png')]
  ffmpeg([...frames, '-vf', 'palettegen=stats_mode=diff', palette])
  ffmpeg([
    ...frames,
    '-i',
    palette,
    '-lavfi',
    'paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
    '-loop',
    '0',
    gif,
  ])
  const mb = statSync(gif).size / 1024 / 1024
  console.log(
    `${env}: ${count} frames, ${(count / FPS).toFixed(1)} s, ${mb.toFixed(2)} MB → ${gif}`,
  )
}
