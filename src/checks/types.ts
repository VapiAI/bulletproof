/**
 * BULLETPROOF - Check types and interfaces
 */

/**
 * Result of a single check
 */
export interface CheckResult {
  /** Whether the check passed */
  passed: boolean
  /** Human-readable message */
  message: string
  /** Detailed output (for debugging) */
  details?: string
  /** Number of errors (for typecheck/tests) */
  errorCount?: number
  /** Number of warnings */
  warningCount?: number
}

/**
 * Coverage metrics
 */
export interface CoverageMetrics {
  lines: number
  statements: number
  functions: number
  branches: number
}

/**
 * Coverage check result
 */
export interface CoverageResult extends CheckResult {
  metrics?: CoverageMetrics
  thresholdsMet?: {
    lines: boolean
    statements: boolean
    functions: boolean
    branches: boolean
  }
}

/**
 * Test results
 */
export interface TestResult extends Omit<CheckResult, 'passed'> {
  /** Whether all tests passed */
  success: boolean
  /** Number of tests passed */
  passedCount: number
  /** Number of tests failed */
  failedCount: number
  /** Number of tests skipped */
  skippedCount: number
}
