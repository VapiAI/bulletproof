/**
 * BULLETPROOF - Terminal spinner with braille patterns
 */

import { colors, gradients } from './colors.js'

/** Braille spinner animation frames */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

/**
 * Terminal spinner state
 */
export interface SpinnerState {
  isActive: boolean
  text: string
  startTime: number
  interval: NodeJS.Timeout | null
  frameIndex: number
}

/**
 * Create a new spinner state
 */
export function createSpinnerState(): SpinnerState {
  return {
    isActive: false,
    text: '',
    startTime: Date.now(),
    interval: null,
    frameIndex: 0,
  }
}

/**
 * Format elapsed time as human-readable string
 */
export function formatElapsed(startTime: number): string {
  const elapsed = Math.floor((Date.now() - startTime) / 1000)
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

/**
 * Start the spinner animation
 */
export function startSpinner(
  state: SpinnerState,
  text: string,
  agentMode: boolean = false
): void {
  state.text = text

  // Agent mode: just print the status, no animation
  if (agentMode) {
    console.log(`[STATUS] ${text}`)
    return
  }

  stopSpinner(state, agentMode)
  state.isActive = true

  state.interval = setInterval(() => {
    state.frameIndex = (state.frameIndex + 1) % SPINNER_FRAMES.length

    // Clean gradient spinner
    const spinner = gradients.bulletproof(SPINNER_FRAMES[state.frameIndex])
    const displayText = state.text.substring(0, 45)
    const elapsed = formatElapsed(state.startTime)

    // Clean output: spinner + text + elapsed time
    process.stdout.write(
      `\r  ${spinner}  ${colors.dim}${displayText.padEnd(45)}${colors.reset} ${colors.cyan}${elapsed}${colors.reset}`
    )
  }, 80)
}

/**
 * Update spinner text
 */
export function updateSpinner(
  state: SpinnerState,
  text: string,
  agentMode: boolean = false
): void {
  const previousText = state.text
  state.text = text

  // Agent mode: print status updates as lines
  if (agentMode && text !== previousText) {
    console.log(`[STATUS] ${text}`)
  }
}

/**
 * Stop the spinner animation
 */
export function stopSpinner(state: SpinnerState, agentMode: boolean = false): void {
  // Agent mode: no spinner to stop
  if (agentMode) return

  if (state.interval) {
    clearInterval(state.interval)
    state.interval = null
  }
  state.isActive = false
  process.stdout.write('\r\x1b[K')
}

/**
 * Reset spinner start time
 */
export function resetSpinnerTime(state: SpinnerState): void {
  state.startTime = Date.now()
}
