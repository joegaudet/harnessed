// Records the demo under each environment and composes its GIF.
//
//   pnpm --filter test-app-demos record                  all five
//   pnpm --filter test-app-demos record cypress-ember    just one (or record:<env>)
//
// Needs ffmpeg on PATH, Playwright's Chromium, and the Cypress app
// (`pnpm --filter test-app-demos exec cypress install`). One run at a time.
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { compose, ENVIRONMENTS } from './compose.mjs'

const APP = new URL('..', import.meta.url)
const PORTS = { react: 5271, ember: 5272 }
/**
 * MARK_COLORS in src/timeline.ts, #00ff00 and #ff00ff, told apart by channel
 * rather than matched exactly: the video's colour management shifts both.
 */
const markOf = ([r, g, b]) => {
  if (g > 180 && r < 180 && b < 160) return 'a'
  if (r > 180 && b > 180 && g < 120) return 'b'
  return null
}
/** The sync mark's corner (cypress/e2e/demo.cy.ts) in CSS pixels, and how often it is read. */
const MARK_PX = 24
const SAMPLE_FPS = 50

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
  // The runner is 1000 CSS pixels wide (cypress.config.ts), whatever the pixel ratio.
  const scale = width / 1000
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
for (const env of envs) {
  rmSync(new URL(`raw/${env}/`, APP), { recursive: true, force: true })
  CAPTURE[env]()
  await compose(env)
}
