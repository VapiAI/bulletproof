/**
 * BULLETPROOF - Diff analysis for intelligent check selection
 */

import { getChangedFiles, getDiffStats } from '../git/utils.js'
import type { ChecksConfig, CoverageScopeConfig, BulletproofConfig } from '../config.js'
import { isInCoverageScope } from '../config.js'

/**
 * Categorized file lists
 */
export interface FileCategories {
  /** Documentation files (.md, .txt, docs/) */
  docs: string[]
  /** Configuration files (.config.*, .json, .yml, etc.) */
  config: string[]
  /** Script files (scripts/, *.sh, etc.) */
  scripts: string[]
  /** Test files (*.test.*, *.spec.*, src/test/) */
  tests: string[]
  /** Type definition files (*.d.ts, src/types/) */
  types: string[]
  /** Source code files (*.ts, *.tsx, *.js, *.jsx) */
  src: string[]
  /** Source files that are in coverage scope */
  coveredSrc: string[]
}

/**
 * Result of diff analysis
 */
export interface DiffAnalysis {
  /** List of all changed files */
  files: string[]
  /** Number of lines added */
  additions: number
  /** Number of lines deleted */
  deletions: number
  /** Categorized file lists */
  categories: FileCategories
  /** Which checks should be run */
  checks: ChecksConfig
  /** Whether to use related tests only */
  useRelatedTests: boolean
  /** Files to use for related tests */
  relatedFiles: string[]
  /** Human-readable reason for check selection */
  reason: string
}

/**
 * Default file categorization patterns
 */
const FILE_PATTERNS = {
  docs: [/\.(md|txt)$/, /^docs\//],
  config: [
    /\.config\.(ts|js|mjs|mts)$/,
    /\.(json|yml|yaml)$/,
    /^\.cursorrules$/,
    /^\.gitignore$/,
    /^\.eslintrc\.json$/,
  ],
  scripts: [
    /^scripts\//,
    /^slack-listener\//,
    /^mcp-server\//,
    /^desktop\//,
    /\.sh$/,
  ],
  tests: [/\.test\./, /\.spec\./, /^src\/test\//],
  types: [/\.d\.ts$/, /^src\/types\//],
  src: [/\.(ts|tsx|js|jsx)$/],
}

/**
 * Categorize a file based on its path
 */
function categorizeFile(
  file: string,
  coverageScope: CoverageScopeConfig
): {
  category: keyof FileCategories | null
  inCoverage: boolean
} {
  // Check categories in priority order
  if (FILE_PATTERNS.docs.some((p) => p.test(file))) {
    return { category: 'docs', inCoverage: false }
  }
  if (FILE_PATTERNS.config.some((p) => p.test(file))) {
    return { category: 'config', inCoverage: false }
  }
  if (FILE_PATTERNS.scripts.some((p) => p.test(file))) {
    return { category: 'scripts', inCoverage: false }
  }
  if (FILE_PATTERNS.tests.some((p) => p.test(file))) {
    return { category: 'tests', inCoverage: false }
  }
  if (FILE_PATTERNS.types.some((p) => p.test(file))) {
    return { category: 'types', inCoverage: false }
  }
  if (FILE_PATTERNS.src.some((p) => p.test(file))) {
    const inCoverage = isInCoverageScope(file, coverageScope)
    return { category: 'src', inCoverage }
  }

  return { category: null, inCoverage: false }
}

/**
 * Analyze git diff and determine which checks to run
 */
export function analyzeDiff(
  config: BulletproofConfig,
  cwd: string = process.cwd()
): DiffAnalysis {
  const result: DiffAnalysis = {
    files: [],
    additions: 0,
    deletions: 0,
    categories: {
      docs: [],
      config: [],
      scripts: [],
      tests: [],
      types: [],
      src: [],
      coveredSrc: [],
    },
    checks: { ...config.checks },
    useRelatedTests: false,
    relatedFiles: [],
    reason: '',
  }

  try {
    // Get changed files
    result.files = getChangedFiles(cwd)

    // Get diff stats
    const stats = getDiffStats(cwd)
    result.additions = stats.additions
    result.deletions = stats.deletions

    // Categorize files
    for (const file of result.files) {
      const { category, inCoverage } = categorizeFile(file, config.coverageScope)
      if (category) {
        result.categories[category].push(file)
        if (category === 'src' && inCoverage) {
          result.categories.coveredSrc.push(file)
        }
      }
    }

    const totalLines = result.additions + result.deletions
    const srcFiles = result.categories.src.length
    const coveredFiles = result.categories.coveredSrc.length
    const testFiles = result.categories.tests.length

    // Determine files for --related flag (src files that tests can relate to)
    const relatedCandidates = [
      ...result.categories.src,
      ...result.categories.tests,
    ].filter((f) => f.startsWith('src/'))

    // Use related tests if:
    // 1. We have src/test files to relate to
    // 2. Diff is small enough that we trust related tests catch issues
    // 3. Changes are focused (not touching too many different areas)
    const shouldUseRelated =
      relatedCandidates.length > 0 &&
      relatedCandidates.length <= 10 &&
      totalLines < 500

    if (shouldUseRelated) {
      result.useRelatedTests = true
      result.relatedFiles = relatedCandidates
    }

    // Determine which checks to run

    // DOCS ONLY: Skip everything except rules
    if (
      result.files.length === result.categories.docs.length &&
      result.files.length > 0
    ) {
      result.checks = {
        rules: true,
        typecheck: false,
        tests: false,
        coverage: false,
      }
      result.reason = `Docs only (${result.files.length} file${result.files.length > 1 ? 's' : ''}) - rules check only`
      return result
    }

    // CONFIG ONLY: Skip tests and coverage
    if (
      result.files.length === result.categories.config.length &&
      result.files.length > 0
    ) {
      result.checks = {
        rules: true,
        typecheck: true,
        tests: false,
        coverage: false,
      }
      result.reason = `Config only (${result.files.length} file${result.files.length > 1 ? 's' : ''}) - skip tests`
      return result
    }

    // SCRIPTS ONLY: Skip coverage (tests still run for script logic)
    if (
      result.files.length === result.categories.scripts.length &&
      result.files.length > 0
    ) {
      result.checks = {
        rules: true,
        typecheck: true,
        tests: true,
        coverage: false,
      }
      result.reason = `Scripts only (${result.files.length} file${result.files.length > 1 ? 's' : ''}) - skip coverage`
      return result
    }

    // TEST FILES ONLY: Run those tests specifically
    if (result.files.length === testFiles && testFiles > 0) {
      result.checks = {
        rules: true,
        typecheck: true,
        tests: true,
        coverage: false,
      }
      result.useRelatedTests = true
      result.relatedFiles = result.categories.tests
      result.reason = `Tests only (${testFiles} file${testFiles > 1 ? 's' : ''}) - run changed tests only`
      return result
    }

    // NO COVERED FILES: Skip coverage entirely
    if (coveredFiles === 0) {
      result.checks = {
        rules: true,
        typecheck: true,
        tests: true,
        coverage: false,
      }
      if (srcFiles > 0) {
        result.reason = `${srcFiles} file${srcFiles > 1 ? 's' : ''} changed (not in coverage scope) - skip coverage`
      } else {
        result.reason = `No covered code changed (${totalLines} lines) - skip coverage`
      }
      return result
    }

    // SMALL DIFF with covered files: Use related tests, skip coverage threshold
    if (totalLines < 200 && coveredFiles <= 3) {
      result.checks.coverage = false // Small changes don't need full coverage check
      result.useRelatedTests = true
      result.reason = `Small diff (${coveredFiles} covered file${coveredFiles > 1 ? 's' : ''}) - related tests only`
      return result
    }

    // MEDIUM DIFF: Use related tests, run coverage
    if (totalLines < 500 && coveredFiles <= 10) {
      result.useRelatedTests = true
      result.reason = `Medium diff (${coveredFiles} covered file${coveredFiles > 1 ? 's' : ''}) - related tests + coverage`
      return result
    }

    // LARGE DIFF: Full test suite (too risky to skip tests)
    result.useRelatedTests = false
    result.relatedFiles = []
    result.reason = `Large diff (${coveredFiles} covered file${coveredFiles > 1 ? 's' : ''}, ${totalLines} lines) - full test suite`
    return result
  } catch {
    // If git commands fail, run all checks
    result.reason = 'Full checks (could not analyze diff)'
    return result
  }
}
