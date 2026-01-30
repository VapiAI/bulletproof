/**
 * BULLETPROOF - ASCII art banners and terminal UI
 */

import chalkAnimation from 'chalk-animation'
import { colors, gradients } from './colors.js'
import type figlet from 'figlet'

// Dynamic import for figlet (ESM compatibility)
let figletInstance: typeof figlet | null = null
async function getFiglet(): Promise<typeof figlet> {
  if (!figletInstance) {
    const mod = await import('figlet')
    figletInstance = mod.default || mod
  }
  return figletInstance
}

/** Active chalk animation reference for cleanup */
let activeAnimation: ReturnType<typeof chalkAnimation.neon> | null = null

/**
 * Sleep utility for animations
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Stop any active animation
 */
export function stopAnimation(): void {
  if (activeAnimation) {
    try {
      activeAnimation.stop()
    } catch {
      // Ignore errors during cleanup
    }
    activeAnimation = null
  }
}

/**
 * Print the animated BULLETPROOF logo
 */
export async function printAnimatedLogo(agentMode: boolean = false): Promise<void> {
  // Agent mode: simple text header, no animations
  if (agentMode) {
    console.log()
    console.log('=== BULLETPROOF PRE-PUSH ===')
    console.log('Running in non-interactive agent mode')
    console.log()
    return
  }

  const figletLib = await getFiglet()
  const logo = figletLib.textSync('BULLETPROOF', {
    font: 'ANSI Shadow',
    horizontalLayout: 'fitted',
  })

  console.log()

  // Start the neon animation on the logo
  activeAnimation = chalkAnimation.neon(logo, 0.5)

  // Let it animate for a moment
  await sleep(1200)

  // Stop animation and print static gradient version
  activeAnimation.stop()
  activeAnimation = null
  process.stdout.write('\x1b[2J\x1b[H') // Clear screen and move cursor to top
  console.log()
  console.log(gradients.bulletproof(logo))

  // Animated subtitle
  const subtitle =
    '  ╭────────────────────────────────────────────────────────────────────────────╮'
  const middle =
    '  │            ⚡ PRE-PUSH AGENT  ·  Powered by Claude Code ⚡                 │'
  const bottom =
    '  ╰────────────────────────────────────────────────────────────────────────────╯'

  console.log(colors.dim + subtitle + colors.reset)
  console.log(gradients.info(middle))
  console.log(colors.dim + bottom + colors.reset)
  console.log()
}

/**
 * Print the mini logo (for hook mode)
 */
export function printMiniLogo(agentMode: boolean = false): void {
  // Agent mode: simple text header
  if (agentMode) {
    console.log()
    console.log('=== BULLETPROOF PRE-PUSH (hook mode) ===')
    return
  }

  const mini = gradients.bulletproof('◆ BULLETPROOF')
  console.log()
  console.log(
    `  ${mini} ${colors.dim}·${colors.reset} ${colors.dim}PRE-PUSH AGENT${colors.reset}`
  )
  printDivider()
}

/**
 * Print a simple divider line
 */
export function printDivider(): void {
  const divider = '─'.repeat(60)
  console.log(`  ${colors.dim}${divider}${colors.reset}`)
}

/**
 * Print a gradient divider line
 */
export function printGradientDivider(): void {
  const chars = '━'.repeat(60)
  console.log(`  ${gradients.bulletproof(chars)}`)
}

/**
 * Print success banner with animation
 */
export async function printSuccessBanner(
  elapsed: string,
  quick: boolean = false,
  agentMode: boolean = false
): Promise<void> {
  console.log()

  // Agent mode: simple text success message
  if (agentMode) {
    console.log('=== ALL CHECKS PASSED ===')
    console.log(`Elapsed: ${elapsed}`)
    console.log()
    return
  }

  // Epic success banner - matches gradient divider width (60 chars)
  const successArt = `
  ╔══════════════════════════════════════════════════════════╗
  ║                                                          ║
  ║          ██████╗  █████╗ ███████╗███████╗                ║
  ║          ██╔══██╗██╔══██╗██╔════╝██╔════╝                ║
  ║          ██████╔╝███████║███████╗███████╗                ║
  ║          ██╔═══╝ ██╔══██║╚════██║╚════██║                ║
  ║          ██║     ██║  ██║███████║███████║                ║
  ║          ╚═╝     ╚═╝  ╚═╝╚══════╝╚══════╝                ║
  ║                                                          ║
  ║    ◆ BULLETPROOF ◆                       ⏱  ${elapsed.padEnd(7)}║
  ╚══════════════════════════════════════════════════════════╝
`

  if (quick) {
    // Quick mode - just gradient, no animation (use bulletproof colors)
    console.log(gradients.bulletproof(successArt))
    return
  }

  // Animate the success banner with neon effect
  activeAnimation = chalkAnimation.neon(successArt, 0.3)
  await sleep(2500)
  activeAnimation.stop()
  activeAnimation = null

  // Print static gradient version with bulletproof colors
  console.log(gradients.bulletproof(successArt))
}

/**
 * Print failure banner with animation
 */
export async function printFailureBanner(
  elapsed: string,
  quick: boolean = false,
  agentMode: boolean = false
): Promise<void> {
  console.log()

  // Agent mode: simple text failure message
  if (agentMode) {
    console.log('=== CHECKS FAILED ===')
    console.log(`Elapsed: ${elapsed}`)
    console.log()
    return
  }

  // Failure banner - matches gradient divider width (60 chars)
  const failArt = `
  ╔══════════════════════════════════════════════════════════╗
  ║                                                          ║
  ║       ███████╗ █████╗ ██╗██╗     ███████╗██████╗         ║
  ║       ██╔════╝██╔══██╗██║██║     ██╔════╝██╔══██╗        ║
  ║       █████╗  ███████║██║██║     █████╗  ██║  ██║        ║
  ║       ██╔══╝  ██╔══██║██║██║     ██╔══╝  ██║  ██║        ║
  ║       ██║     ██║  ██║██║███████╗███████╗██████╔╝        ║
  ║       ╚═╝     ╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚═════╝         ║
  ║                                                          ║
  ║    ◆ BULLETPROOF ◆                       ⏱  ${elapsed.padEnd(7)}║
  ╚══════════════════════════════════════════════════════════╝
`

  if (quick) {
    // Quick mode - just gradient, no animation
    console.log(gradients.fail(failArt))
    return
  }

  // Glitch animation for failure
  activeAnimation = chalkAnimation.glitch(failArt, 0.5)
  await sleep(2000)
  activeAnimation.stop()
  activeAnimation = null

  // Print static red version
  console.log(gradients.fail(failArt))
}
