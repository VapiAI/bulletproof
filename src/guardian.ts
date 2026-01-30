/**
 * BULLETPROOF - GuardianRunner
 *
 * Main orchestrator class that coordinates all checks and Claude agent.
 */

import { execSync } from 'child_process'
import type { BulletproofConfig } from './config.js'
import { loadConfig } from './config.js'
import { analyzeDiff, type DiffAnalysis } from './diff/analyzer.js'
import { runClaudeAgent } from './claude/runner.js'
import {
  runDiscovery,
  formatDiscoverySummary,
  type DiscoveryResult,
} from './discovery/index.js'
import {
  pullAndMergeMain,
  commitFixes,
  pushToRemote,
} from './git/utils.js'
import {
  printAnimatedLogo,
  printMiniLogo,
  printSuccessBanner,
  printFailureBanner,
  printGradientDivider,
  stopAnimation,
} from './ui/banners.js'
import { colors, gradients } from './ui/colors.js'
import {
  createSpinnerState,
  formatElapsed,
  stopSpinner,
  type SpinnerState,
} from './ui/spinner.js'
import {
  createSectionsState,
  printFinalSummary,
  markAllPassed,
  type SectionsState,
} from './ui/sections.js'

/**
 * Options for running the guardian
 */
export interface GuardianOptions {
  /** Skip pushing to remote after checks pass */
  skipPush?: boolean
  /** Run in hook mode (mini logo, quick banners) */
  hookMode?: boolean
  /** Run in non-interactive agent mode */
  agentMode?: boolean
  /** Show verbose output */
  verbose?: boolean
  /** Working directory */
  cwd?: string
}

/**
 * Result of running the guardian
 */
export interface GuardianResult {
  /** Whether all checks passed */
  success: boolean
  /** Time elapsed */
  elapsed: string
  /** Diff analysis results */
  analysis: DiffAnalysis
  /** Whether fixes were committed */
  fixesCommitted: boolean
  /** Whether changes were pushed */
  pushed: boolean
  /** Error message if failed */
  error?: string
}

/**
 * Guardian state during execution
 */
interface GuardianState {
  config: BulletproofConfig
  options: Required<GuardianOptions>
  spinnerState: SpinnerState
  sectionsState: SectionsState | null
  startTime: number
  isCleaningUp: boolean
  discovery: DiscoveryResult | null
}

/**
 * GuardianRunner - Main class for running BULLETPROOF checks
 */
export class GuardianRunner {
  private state: GuardianState

  constructor(options: GuardianOptions = {}) {
    const cwd = options.cwd ?? process.cwd()

    // Auto-detect agent mode
    const agentMode =
      options.agentMode ??
      (process.env.CI === 'true' ||
       process.env.AGENT_MODE === 'true' ||
       !process.stdout.isTTY)

    this.state = {
      config: loadConfig(cwd),
      options: {
        skipPush: options.skipPush ?? false,
        hookMode: options.hookMode ?? false,
        agentMode,
        verbose: options.verbose ?? false,
        cwd,
      },
      spinnerState: createSpinnerState(),
      sectionsState: null,
      startTime: Date.now(),
      isCleaningUp: false,
      discovery: null,
    }

    // Setup cleanup handlers
    this.setupCleanupHandlers()
  }

  /**
   * Setup process termination handlers
   */
  private setupCleanupHandlers(): void {
    const cleanup = (): void => {
      if (this.state.isCleaningUp) return
      this.state.isCleaningUp = true

      stopSpinner(this.state.spinnerState, this.state.options.agentMode)
      stopAnimation()
      process.stdout.write('\r\x1b[K')
    }

    process.on('SIGINT', () => {
      cleanup()
      console.log(
        `\n\n  ${colors.yellow}⚠${colors.reset}  ${colors.dim}Cancelled by user${colors.reset}\n`
      )
      setTimeout(() => process.exit(130), 100).unref()
      process.exit(130)
    })

    process.on('SIGTERM', () => {
      cleanup()
      setTimeout(() => process.exit(143), 100).unref()
      process.exit(143)
    })

    process.on('exit', cleanup)
  }

  /**
   * Run all checks and attempt to fix issues
   */
  async run(): Promise<GuardianResult> {
    const { options, config, spinnerState } = this.state
    const { agentMode, hookMode, cwd, skipPush, verbose } = options

    this.state.startTime = Date.now()

    // Print logo
    if (!hookMode) {
      await printAnimatedLogo(agentMode)
    } else {
      printMiniLogo(agentMode)
    }

    // Run discovery if enabled
    if (config.discovery.autoDiscoverScripts) {
      this.state.discovery = runDiscovery(cwd, {
        conventions: config.discovery.conventions,
        discoverScripts: true,
      })

      if (verbose) {
        if (agentMode) {
          console.log('[DISCOVERY]')
          console.log(formatDiscoverySummary(this.state.discovery))
        } else {
          console.log(`  ${colors.dim}Discovery:${colors.reset}`)
          console.log(
            `  ${colors.dim}${formatDiscoverySummary(this.state.discovery).split('\n').join('\n  ')}${colors.reset}`
          )
        }
      }
    }

    // Analyze diff
    const analysis = analyzeDiff(config, cwd)
    this.state.sectionsState = createSectionsState(analysis.checks)

    // Display analysis
    this.printAnalysis(analysis)

    // Pull and merge from main
    const mergeResult = pullAndMergeMain(cwd, agentMode)
    if (mergeResult.error) {
      if (agentMode) {
        console.log(`[WARN] Could not sync: ${mergeResult.error}`)
      } else {
        console.log(
          `  ${colors.yellow}⚠${colors.reset}  ${colors.dim}Could not sync: ${mergeResult.error}${colors.reset}`
        )
      }
    }

    // Print initial progress
    this.printInitialProgress()

    // Run Claude agent
    const claudeResult = await runClaudeAgent({
      config,
      analysis,
      hasConflicts: mergeResult.hasConflicts,
      sectionsState: this.state.sectionsState,
      spinnerState,
      agentMode,
      verbose,
      cwd,
      discovery: this.state.discovery ?? undefined,
    })

    let success = claudeResult.success

    // Verify final state if not already successful
    if (!success) {
      success = this.verifyFinalState(cwd, agentMode)
    }

    const elapsed = formatElapsed(this.state.startTime)

    // Mark all sections as passed if successful
    if (success && this.state.sectionsState) {
      markAllPassed(this.state.sectionsState)
    }

    // Print summary
    if (this.state.sectionsState) {
      printFinalSummary(this.state.sectionsState, agentMode)
    }

    let fixesCommitted = false
    let pushed = false

    if (success) {
      // Commit any changes
      fixesCommitted = commitFixes(cwd, agentMode)

      if (hookMode && fixesCommitted) {
        await printSuccessBanner(elapsed, true, agentMode)
        if (agentMode) {
          console.log(
            '[INFO] Auto-fix commit added — will be included in push'
          )
        } else {
          console.log(
            `  ${colors.dim}Auto-fix commit added — will be included in push${colors.reset}`
          )
        }
        console.log()
      } else if (hookMode) {
        await printSuccessBanner(elapsed, true, agentMode)
      } else {
        await printSuccessBanner(elapsed, false, agentMode)

        if (!skipPush) {
          pushed = pushToRemote(cwd, agentMode)
          if (!pushed) {
            return {
              success: false,
              elapsed,
              analysis,
              fixesCommitted,
              pushed: false,
              error: 'Push failed',
            }
          }
        }
      }
    } else {
      await printFailureBanner(elapsed, hookMode, agentMode)
      if (agentMode) {
        console.log('[INFO] Could not automatically resolve all issues.')
        console.log('[INFO] Review the output above and fix manually.')
      } else {
        console.log(
          `  ${colors.dim}Could not automatically resolve all issues.${colors.reset}`
        )
        console.log(
          `  ${colors.dim}Review the output above and fix manually.${colors.reset}`
        )
      }
      console.log()
    }

    return {
      success,
      elapsed,
      analysis,
      fixesCommitted,
      pushed,
      error: claudeResult.error,
    }
  }

  /**
   * Print diff analysis results
   */
  private printAnalysis(analysis: DiffAnalysis): void {
    const { agentMode } = this.state.options

    console.log()
    if (agentMode) {
      console.log(`[ANALYSIS] ${analysis.reason}`)
      if (analysis.files.length > 0) {
        console.log(
          `[FILES] ${analysis.files.length <= 10 ? analysis.files.join(', ') : `${analysis.files.slice(0, 5).join(', ')} +${analysis.files.length - 5} more`}`
        )
      }
      if (analysis.useRelatedTests && analysis.relatedFiles.length > 0) {
        console.log(
          `[OPTIMIZATION] Running only related tests (${analysis.relatedFiles.length} files)`
        )
      }
    } else {
      console.log(`  ${gradients.bulletproof('◆')}  ${analysis.reason}`)

      if (analysis.files.length > 0 && analysis.files.length <= 5) {
        console.log(
          `     ${colors.dim}${analysis.files.join(', ')}${colors.reset}`
        )
      } else if (analysis.files.length > 5) {
        console.log(
          `     ${colors.dim}${analysis.files.slice(0, 3).join(', ')} +${analysis.files.length - 3} more${colors.reset}`
        )
      }

      if (analysis.useRelatedTests && analysis.relatedFiles.length > 0) {
        console.log(
          `     ${colors.cyan}⚡${colors.reset} ${colors.dim}Running only related tests (${analysis.relatedFiles.length} file${analysis.relatedFiles.length > 1 ? 's' : ''})${colors.reset}`
        )
      }
    }
  }

  /**
   * Print initial progress indicator
   */
  private printInitialProgress(): void {
    const { agentMode } = this.state.options
    const { sectionsState } = this.state

    if (!sectionsState) return

    console.log()
    if (agentMode) {
      console.log(
        `[INIT] Starting ${sectionsState.sections.length} checks: ${sectionsState.sections.map((s) => s.name).join(', ')}`
      )
    } else {
      const initialProgress = sectionsState.sections
        .map(() => colors.dim + '○' + colors.reset)
        .join(' ')
      const initName = `◆  Initializing...`
      const paddedInitName = initName.padEnd(20)
      console.log(
        `  ${gradients.bulletproof(paddedInitName)}${' '.repeat(26)}${initialProgress} ${colors.dim}0/${sectionsState.sections.length}${colors.reset}`
      )
      printGradientDivider()
    }
  }

  /**
   * Verify final state by running checks one more time
   */
  private verifyFinalState(cwd: string, agentMode: boolean): boolean {
    console.log()
    if (agentMode) {
      console.log('[VERIFY] Running final verification...')
    } else {
      console.log(`  ${colors.dim}Verifying final state...${colors.reset}`)
    }

    try {
      execSync(this.state.config.commands.typecheck, { stdio: 'pipe', cwd })
      execSync(this.state.config.commands.testCoverage, { stdio: 'pipe', cwd })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): BulletproofConfig {
    return this.state.config
  }
}

/**
 * Convenience function to run the guardian
 */
export async function runGuardian(
  options: GuardianOptions = {}
): Promise<GuardianResult> {
  const guardian = new GuardianRunner(options)
  return guardian.run()
}
