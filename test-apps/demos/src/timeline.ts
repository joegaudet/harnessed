/**
 * Recording plumbing shared by the five environments. None of it is part of the
 * demo: under `test` every pause is zero and nothing is written.
 */

/** The environments a recording exists for, and the GIF each one becomes. */
export const ENVS = [
  'rtl',
  'playwright-react',
  'playwright-ember',
  'cypress-react',
  'cypress-ember',
] as const
export type EnvId = (typeof ENVS)[number]

/** How long what each step left on screen is held before the next one runs. */
export const STEP_PAUSE_MS = 1400
/** How long the final state is held once the demo has finished. */
export const TAIL_MS = 1800

export interface StepMark {
  label: string
  /** Milliseconds from the start of the run (the recorder moves it onto the footage). */
  at: number
}

/** What a recording writes beside its footage: when each step began, and the end. */
export interface Timeline {
  env: EnvId
  steps: StepMark[]
  /** When the demo resolved, on the same clock as `steps`. */
  end: number
  /**
   * Playwright only: when the page first painted, on the same clock. The recorder
   * finds that moment in the footage and shifts the timeline onto the video's.
   */
  firstPaint?: number
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * A `step` hook that, when recording, first holds what the previous step left on
 * screen, then notes when this one begins against `now()`. `onStep` lets a runner
 * leave its own mark too.
 */
export function stepper(options: {
  now: () => number
  pauseMs: number
  onStep?: (index: number, label: string) => void
}) {
  const steps: StepMark[] = []
  return {
    steps,
    async step(label: string): Promise<void> {
      if (options.pauseMs > 0) await sleep(options.pauseMs)
      steps.push({ label, at: options.now() })
      options.onStep?.(steps.length - 1, label)
    },
  }
}
