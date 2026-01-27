/**
 * @vapi/bulletproof
 *
 * Pre-push guardian that uses Claude to run checks and auto-fix issues.
 *
 * @example
 * ```typescript
 * import { runGuardian, GuardianRunner } from '@vapi/bulletproof'
 *
 * // Simple usage
 * const result = await runGuardian({ skipPush: true })
 *
 * // Advanced usage with custom options
 * const guardian = new GuardianRunner({
 *   hookMode: true,
 *   verbose: true,
 * })
 * const result = await guardian.run()
 * ```
 */

// Main exports
export { GuardianRunner, runGuardian } from './guardian.js'
export type { GuardianOptions, GuardianResult } from './guardian.js'

// Configuration
export {
  loadConfig,
  loadConfigFile,
  mergeConfig,
  isInCoverageScope,
  DEFAULT_CONFIG,
} from './config.js'
export type {
  BulletproofConfig,
  ChecksConfig,
  CommandsConfig,
  CoverageThresholds,
  CoverageScopeConfig,
} from './config.js'

// Diff analysis
export { analyzeDiff } from './diff/analyzer.js'
export type { DiffAnalysis, FileCategories } from './diff/analyzer.js'

// Git utilities
export {
  hasUncommittedChanges,
  pullAndMergeMain,
  commitFixes,
  pushToRemote,
  getChangedFiles,
  getDiffStats,
} from './git/utils.js'
export type { MergeResult } from './git/utils.js'

// Check types
export type {
  CheckResult,
  CoverageMetrics,
  CoverageResult,
  TestResult,
} from './checks/types.js'

// UI exports (for custom implementations)
export { colors, gradients, colorize, bold, dim } from './ui/colors.js'
export {
  createSpinnerState,
  startSpinner,
  updateSpinner,
  stopSpinner,
  formatElapsed,
} from './ui/spinner.js'
export type { SpinnerState } from './ui/spinner.js'
export {
  printAnimatedLogo,
  printMiniLogo,
  printDivider,
  printGradientDivider,
  printSuccessBanner,
  printFailureBanner,
  stopAnimation,
} from './ui/banners.js'
export {
  ALL_SECTIONS,
  createSectionsState,
  printSectionHeader,
  updateSectionStatus,
  startSection,
  printFinalSummary,
  markAllPassed,
} from './ui/sections.js'
export type { Section, SectionStatus, SectionsState } from './ui/sections.js'

// Claude integration
export { generatePrompt, generateSystemPrompt } from './claude/prompt.js'
export { runClaudeAgent } from './claude/runner.js'
export type { ClaudeRunnerOptions, ClaudeRunnerResult } from './claude/runner.js'
