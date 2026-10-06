// Records the demo under each environment and composes its GIF.
//
//   pnpm --filter test-app-demos record                  all five
//   pnpm --filter test-app-demos record cypress-ember    just one (or record:<env>)
//
// Needs ffmpeg and ffprobe on PATH, Playwright's Chromium
// (`pnpm --filter test-app-demos exec playwright install chromium`), the Cypress
// binary (`pnpm --filter test-app-demos exec cypress install`), and the
// packages built (`pnpm build` at the repo root). One run at a time.
//
// Recording all five also writes docs/media/demo.sha256, the hash of the
// src/demo.ts the GIFs show; rtl/demo.test.ts fails once demo.ts moves on.
// Recording some of them requires demo.ts to still match that hash.
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CYPRESS_WINDOW, MARK_COLORS, MARK_PX, PORTS } from '../src/constants.mjs'
import { DEMO_HASH_FILE, demoHashLine, readDemoHash, writeDemoHash } from '../src/demo-hash.mjs'
import { compose, ENVIRONMENTS, FPS as GIF_FPS } from './compose.mjs'

const APP = new URL('..', import.meta.url)
/**
 * MARK_COLORS, told apart by channel rather than matched exactly: the video's
 * colour management shifts both.
 */
const markOf = ([r, g, b]) => {
  if (g > 180 && r < 180 && b < 160) return 'a'
  if (r > 180 && b > 180 && g < 120) return 'b'
  return null
}
const rgbOf = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
if (MARK_COLORS.map(color => markOf(rgbOf(color))).join() !== 'a,b') {
  throw new Error(`markOf no longer tells MARK_COLORS (${MARK_COLORS.join(', ')}) apart`)
}
/** How often the sync mark is read. */
const SAMPLE_FPS = 50
/**
 * The most the spec's clock and the footage's may disagree by: two of the GIF's
 * frames. Past that, a step would light up in the code panel visibly off its
 * footage. Recordings so far have measured 110-170 ms.
 */
const MAX_DRIFT_MS = (2 * 1000) / GIF_FPS

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: fileURLToPath(APP),
    stdio: 'inherit',
    env: { ...process.env, DEMO_RECORD: '1' },
  })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with ${result.status ?? result.signal}`)
  }
}

function probeSize(footage) {
  return execFileSync('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height',
    '-of',
    'csv=p=0',
    footage,
  ])
    .toString()
    .trim()
    .split(',')
    .map(Number)
}

/** The average colour of one region of the footage, SAMPLE_FPS times a second. */
function sampleRegion(footage, { width, height, x, y }) {
  const pixels = execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      footage,
      '-vf',
      `fps=${SAMPLE_FPS},crop=${width}:${height}:${x}:${y},scale=1:1:flags=area`,
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      'pipe:',
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  )
  const samples = []
  for (let i = 0; i + 2 < pixels.length; i += 3) {
    samples.push({
      at: Math.round((samples.length * 1000) / SAMPLE_FPS),
      rgb: [pixels[i], pixels[i + 1], pixels[i + 2]],
    })
  }
  return samples
}

function readTimeline(env) {
  return JSON.parse(readFileSync(new URL(`raw/${env}/timeline.json`, APP), 'utf8'))
}

function writeTimeline(env, timeline) {
  writeFileSync(new URL(`raw/${env}/timeline.json`, APP), `${JSON.stringify(timeline, null, 2)}\n`)
}

/**
 * Moves a Playwright timeline onto its video's clock. The page's first paint
 * was timestamped by the browser; in the footage it is the first frame where
 * the top-left corner, blank until then, darkens with the heading.
 */
function syncToFirstPaint(env) {
  const footage = fileURLToPath(new URL(`raw/${env}/footage.webm`, APP))
  const timeline = readTimeline(env)
  const corner = sampleRegion(footage, { width: 200, height: 60, x: 0, y: 0 })
  const painted = corner.find(({ rgb }) => Math.min(...rgb) < 240)
  if (painted === undefined || timeline.firstPaint === undefined) {
    throw new Error(`${env}: could not find the first paint in the footage`)
  }
  const shift = timeline.firstPaint - painted.at
  console.log(`${env}: footage starts ${shift} ms into the run; timeline shifted to match`)
  timeline.steps = timeline.steps.map(step => ({ ...step, at: step.at - shift }))
  timeline.end -= shift
  writeTimeline(env, timeline)
}

/**
 * Times the Cypress steps from the footage itself: each step flipped the corner
 * mark, so the frames where its colour changes are the steps.
 */
function syncToMarks(env) {
  const footage = fileURLToPath(new URL(`raw/${env}/footage.mp4`, APP))
  const timeline = readTimeline(env)
  const [width, height] = probeSize(footage)
  // The runner is CYPRESS_WINDOW.width CSS pixels wide, whatever the pixel ratio.
  const scale = width / CYPRESS_WINDOW.width
  const side = Math.round((MARK_PX / 3) * scale)
  const samples = sampleRegion(footage, {
    width: side,
    height: side,
    x: side,
    y: height - 2 * side,
  })
  const flips = []
  let last = null
  for (const { at, rgb } of samples) {
    const kind = markOf(rgb)
    if (kind !== null && kind !== last) {
      flips.push(at)
      last = kind
    }
  }
  if (flips.length !== timeline.steps.length) {
    throw new Error(
      `${env}: found ${flips.length} step marks in the footage; ` +
        `the run recorded ${timeline.steps.length} steps`,
    )
  }
  // The spec's own clock, against the footage's: they should agree to a frame or two.
  const drift = Math.max(
    ...timeline.steps.map((step, i) =>
      Math.abs(step.at - timeline.steps[0].at - (flips[i] - flips[0])),
    ),
  )
  if (drift > MAX_DRIFT_MS) {
    throw new Error(
      `${env}: the spec's clock and the footage disagree by ${drift} ms ` +
        `(more than ${MAX_DRIFT_MS} ms, two GIF frames); record ${env} again`,
    )
  }
  console.log(`${env}: synced ${flips.length} steps to the footage (clock drift ≤ ${drift} ms)`)
  const lastStep = timeline.steps.at(-1).at
  timeline.end = flips.at(-1) + (timeline.end - lastStep)
  timeline.steps = timeline.steps.map((step, i) => ({ ...step, at: flips[i] }))
  writeTimeline(env, timeline)
}

function playwright(app) {
  run('pnpm', ['exec', 'playwright', 'test', '--project', app])
  syncToFirstPaint(`playwright-${app}`)
}

function cypress(app) {
  const env = `cypress-${app}`
  run('pnpm', [
    'exec',
    'start-server-and-test',
    `serve:${app}`,
    `http-get://localhost:${PORTS[app]}`,
    `cy:${app}`,
  ])
  renameSync(
    new URL('raw/cypress-videos/demo.cy.ts.mp4', APP),
    new URL(`raw/${env}/footage.mp4`, APP),
  )
  syncToMarks(env)
}

const CAPTURE = {
  rtl: () => run('pnpm', ['exec', 'vitest', 'run']),
  'playwright-react': () => playwright('react'),
  'playwright-ember': () => playwright('ember'),
  'cypress-react': () => cypress('react'),
  'cypress-ember': () => cypress('ember'),
}

const requested = process.argv.slice(2)
const envs = requested.length > 0 ? requested : Object.keys(ENVIRONMENTS)
for (const env of envs) {
  if (!(env in CAPTURE)) {
    throw new Error(`unknown environment "${env}"; one of ${Object.keys(CAPTURE).join(', ')}`)
  }
}
const all = Object.keys(CAPTURE).every(env => envs.includes(env))
if (!all && readDemoHash() !== demoHashLine()) {
  throw new Error(
    `src/demo.ts no longer matches ${DEMO_HASH_FILE}, so the other GIFs show old code: ` +
      'record all five (`pnpm --filter test-app-demos record`)',
  )
}
for (const env of envs) {
  rmSync(new URL(`raw/${env}/`, APP), { recursive: true, force: true })
  CAPTURE[env]()
  await compose(env)
}
if (all) {
  writeDemoHash()
  console.log(`src/demo.ts hash → ${DEMO_HASH_FILE}`)
}
