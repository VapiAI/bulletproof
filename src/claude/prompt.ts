/**
 * BULLETPROOF - Prompt generation for Claude Agent SDK
 */

import type { DiffAnalysis } from '../diff/analyzer.js'
import type { BulletproofConfig } from '../config.js'
import type { DiscoveryResult } from '../discovery/index.js'

/**
 * Prompt generation options
 */
export interface PromptOptions {
  config: BulletproofConfig
  analysis: DiffAnalysis
  hasConflicts: boolean
  discovery?: DiscoveryResult
}

/**
 * Generate the system prompt for Claude
 */
export function generateSystemPrompt(
  config: BulletproofConfig,
  discovery?: DiscoveryResult
): string {
  // Determine convention file references
  const conventionFiles = discovery?.conventions ?? []
  const conventionList =
    conventionFiles.length > 0
      ? conventionFiles.map((f) => f.path).join(', ')
      : config.rulesFile

  const base = `You are an expert TypeScript/React developer running pre-push checks and ensuring code follows project conventions.
You are working in the current directory - DO NOT cd to any other directory.
Your goals are:
1. Make all checks pass (lint, format, typecheck, build, tests, coverage)
2. Ensure ALL changed files comply with project conventions

Be systematic: run checks, analyze failures, fix issues, verify fixes, repeat.
${conventionFiles.length > 0 ? `Project conventions are loaded from: ${conventionList}` : `ALWAYS read ${config.rulesFile} FIRST (use cat ${config.rulesFile}) - it contains ALL the conventions your code MUST follow.`}
After checks pass, review changed files against conventions and fix any violations.
Do NOT read files from other users' directories.`

  if (config.systemPrompt) {
    return `${base}\n\n${config.systemPrompt}`
  }

  return base
}

/**
 * Generate the merge conflict resolution prompt
 */
export function generateMergeConflictPrompt(): string {
  return `
## FIRST: Resolve Merge Conflicts

There are merge conflicts from merging origin/main. You MUST resolve these first:

1. Run \`git status\` to see conflicted files
2. For each conflicted file:
   - Read the file to see the conflict markers (<<<<<<< HEAD, =======, >>>>>>> origin/main)
   - Understand both versions and resolve intelligently (usually keep both changes if they don't conflict)
   - Remove ALL conflict markers
   - Write the resolved file
3. After resolving all conflicts, run \`git add -A\` then \`git commit -m "merge: resolve conflicts with main"\`
4. Verify with \`git status\` that merge is complete (no conflicts remaining)

Only proceed to the checks below AFTER all merge conflicts are resolved.

`
}

/**
 * Generate the main prompt for Claude
 */
export function generatePrompt(
  config: BulletproofConfig,
  analysis: DiffAnalysis,
  hasConflicts: boolean,
  discovery?: DiscoveryResult
): string {
  const checksToRun: string[] = []
  const checksToSkip: string[] = []

  // Determine convention file references
  const conventionFiles = discovery?.conventions ?? []
  const conventionRef =
    conventionFiles.length > 0
      ? 'project conventions'
      : config.rulesFile

  // Get discovered commands or fall back to config
  const getCommand = (
    category: 'lint' | 'format' | 'build'
  ): string | null => {
    if (discovery?.scripts.scripts[category]) {
      return discovery.scripts.scripts[category]!.runCommand
    }
    return config.commands[category]
  }

  if (analysis.checks.rules) {
    checksToRun.push(
      `1. **RULES COMPLIANCE CHECK**: Review changed files against ${conventionRef}`
    )
  } else {
    checksToSkip.push('Rules compliance (docs only)')
  }

  // Add lint check if enabled and available
  const lintCmd = getCommand('lint')
  if (analysis.checks.lint && lintCmd) {
    checksToRun.push(
      `${checksToRun.length + 1}. Run \`${lintCmd}\` - fix ALL linting errors`
    )
  } else if (analysis.checks.lint) {
    checksToSkip.push('Lint (no lint script found)')
  } else {
    checksToSkip.push('Lint (no code changes)')
  }

  // Add format check if enabled and available
  const formatCmd = getCommand('format')
  if (analysis.checks.format && formatCmd) {
    checksToRun.push(
      `${checksToRun.length + 1}. Run \`${formatCmd}\` - ensure code formatting is correct`
    )
  } else if (analysis.checks.format) {
    checksToSkip.push('Format (no format script found)')
  } else {
    checksToSkip.push('Format (no code changes)')
  }

  if (analysis.checks.typecheck) {
    checksToRun.push(
      `${checksToRun.length + 1}. Run \`${config.commands.typecheck}\` - fix ALL type errors`
    )
  } else {
    checksToSkip.push('Typecheck (no code changes)')
  }

  // Add build check if enabled and available
  const buildCmd = getCommand('build')
  if (analysis.checks.build && buildCmd) {
    checksToRun.push(
      `${checksToRun.length + 1}. Run \`${buildCmd}\` - ensure project builds successfully`
    )
  } else if (analysis.checks.build) {
    checksToSkip.push('Build (no build script found)')
  } else {
    checksToSkip.push('Build (no code changes)')
  }

  if (analysis.checks.tests) {
    if (analysis.useRelatedTests && analysis.relatedFiles.length > 0) {
      const relatedFilesStr = analysis.relatedFiles.join(' ')
      checksToRun.push(
        `${checksToRun.length + 1}. Run \`${config.commands.testRelated} ${relatedFilesStr}\` - run only tests related to changed files`
      )
    } else {
      checksToRun.push(
        `${checksToRun.length + 1}. Run \`${config.commands.test}\` - verify all tests pass`
      )
    }
  } else {
    checksToSkip.push('Tests (no testable changes)')
  }

  if (analysis.checks.coverage) {
    if (analysis.useRelatedTests && analysis.relatedFiles.length > 0) {
      const relatedFilesStr = analysis.relatedFiles.join(' ')
      checksToRun.push(
        `${checksToRun.length + 1}. Run \`${config.commands.testCoverageRelated} ${relatedFilesStr}\` - coverage for related tests only`
      )
    } else {
      checksToRun.push(
        `${checksToRun.length + 1}. Run \`${config.commands.testCoverage}\` - verify coverage thresholds`
      )
    }
  } else {
    checksToSkip.push('Coverage (not needed for this diff)')
  }

  const skipSection =
    checksToSkip.length > 0
      ? `\n## SKIPPED CHECKS (based on diff analysis):\n${checksToSkip.map((s) => `- ${s}`).join('\n')}\n\nThese checks are skipped because the changes don't require them.\n`
      : ''

  const mergeConflictPrompt = hasConflicts ? generateMergeConflictPrompt() : ''

  const thresholds = config.coverageThresholds

  const coverageInstructions = analysis.checks.coverage
    ? `## BE SMART ABOUT COVERAGE:
Look at what files were actually changed (from git diff). Use judgment:

**SKIP coverage fixes for:**
- Scripts (scripts/*, *.sh) - build tools don't need tests
- Config files (*.config.*, .cursorrules, etc.)
- Documentation (*.md, docs/*)
- Type definitions only
- Small formatting/style changes

**DO care about coverage for:**
- New API routes - need tests
- New components - need tests
- New utilities/hooks - need tests
- Business logic changes - existing tests should pass

If coverage fails but the changed files are scripts/config/docs, just report it and move on.
Only try to fix coverage if you added NEW code that genuinely needs tests.`
    : `## NOTE: Coverage check is SKIPPED for this diff.
Reason: ${analysis.reason}
Just run the checks listed above and report results.`

  // Generate conventions section based on discovery
  const conventionsSection = generateConventionsSection(
    config,
    analysis,
    hasConflicts,
    conventionFiles
  )

  // Build reporting instructions based on available checks
  const reportingInstructions = generateReportingInstructions(
    analysis,
    lintCmd,
    formatCmd,
    buildCmd,
    thresholds
  )

  const prompt = `You are running pre-push checks for THIS project in the current working directory.
${skipSection}
${mergeConflictPrompt}
${conventionsSection}

## Your Task (in order):
${checksToRun.join('\n')}

${coverageInstructions}

## RULES COMPLIANCE CHECK (Step 1):
Run \`git diff HEAD~1 --name-only\` to see changed files, then review them against ${conventionRef}:

**For API routes, verify:**
- Uses proper authentication
- Returns proper HTTP status codes (200, 201, 400, 401, 403, 404, 500)
- Has corresponding tests

**For ALL files, verify:**
- No hardcoded values (use constants)
- TypeScript types are explicit (no \`any\`)
- Follows existing code patterns

Report after compliance check:
✓ RULES COMPLIANCE PASSED  or  ✗ RULES COMPLIANCE: [list violations]

If violations found, fix them, then re-run the checks.

${reportingInstructions}

## SPEED TIPS:
- Rules check is fast - review changed files first to catch convention issues early
- Lint and format are fast - fix these first before typecheck
- typecheck is fast (~30s) - fix all type errors before running tests
- \`${config.commands.test}\` is faster than ${config.commands.testCoverage} - use it to verify test fixes
- Only run the full coverage check when you think everything should pass

## FIXING ISSUES:
- DO fix any lint or format errors you encounter
- DO fix any test failures you encounter, even if unrelated to this PR
- DO fix any typecheck errors, even if unrelated
- But for COVERAGE specifically, use the "BE SMART ABOUT COVERAGE" rules above
- Coverage is different - don't try to add tests for old code just to hit thresholds

## Before making code changes:
1. Re-read relevant sections of ${conventionRef} for the specific patterns
2. Look at similar existing files for patterns

## Rules:
- Make minimal changes - fix only what's broken
- Follow existing code patterns exactly
- For test files, copy patterns from similar existing tests

## When finished:
- If all checks AND rules compliance pass, say "ALL CHECKS PASSED"
- If stuck, explain what's blocking you
${config.additionalInstructions ? `\n## Additional Instructions:\n${config.additionalInstructions}` : ''}

${getStartingInstructions(config, analysis, lintCmd, conventionFiles)}`

  return prompt
}

/**
 * Generate the conventions section based on discovery
 */
function generateConventionsSection(
  config: BulletproofConfig,
  analysis: DiffAnalysis,
  hasConflicts: boolean,
  conventionFiles: DiscoveryResult['conventions']
): string {
  const prefix = hasConflicts ? 'THEN' : 'FIRST'

  if (conventionFiles.length > 0) {
    const fileList = conventionFiles.map((f) => `- ${f.path}`).join('\n')
    if (analysis.checks.rules) {
      return `## ${prefix}: Project conventions have been loaded from:
${fileList}

These conventions are already available to you. Review them to understand the project patterns.`
    } else {
      return `## NOTE: Skipping conventions check for this docs-only change.
Convention files available: ${conventionFiles.map((f) => f.path).join(', ')}`
    }
  }

  // Fallback to legacy rulesFile
  if (analysis.checks.rules) {
    return `## ${prefix}: Read the project rules
Run \`cat ${config.rulesFile}\` and read the entire file carefully. This contains ALL project conventions, patterns, and rules that your changes MUST follow.`
  }

  return `## NOTE: Skipping conventions check for this docs-only change.`
}

/**
 * Generate reporting instructions based on available checks
 */
function generateReportingInstructions(
  analysis: DiffAnalysis,
  lintCmd: string | null,
  formatCmd: string | null,
  buildCmd: string | null,
  thresholds: { lines: number; statements: number; functions: number; branches: number }
): string {
  const instructions: string[] = ['## IMPORTANT - Report results after EVERY command:']

  if (analysis.checks.lint && lintCmd) {
    instructions.push(`
After lint, report:
✓ LINT PASSED  or  ✗ LINT FAILED (X errors)`)
  }

  if (analysis.checks.format && formatCmd) {
    instructions.push(`
After format check, report:
✓ FORMAT PASSED  or  ✗ FORMAT FAILED (X files need formatting)`)
  }

  instructions.push(`
After typecheck, report:
✓ TYPECHECK PASSED  or  ✗ TYPECHECK FAILED (X errors)`)

  if (analysis.checks.build && buildCmd) {
    instructions.push(`
After build, report:
✓ BUILD PASSED  or  ✗ BUILD FAILED`)
  }

  instructions.push(`
After tests, report:
✓ TESTS: X passed, Y failed, Z skipped  or  ✗ TESTS FAILED: X passed, Y failed

After coverage, report ALL FOUR metrics:
📊 COVERAGE: Lines X% | Statements X% | Functions X% | Branches X%
Then note if each meets threshold: Lines ≥${thresholds.lines}%, Statements ≥${thresholds.statements}%, Functions ≥${thresholds.functions}%, Branches ≥${thresholds.branches}%`)

  return instructions.join('')
}

/**
 * Generate starting instructions based on what's available
 */
function getStartingInstructions(
  config: BulletproofConfig,
  analysis: DiffAnalysis,
  lintCmd: string | null,
  conventionFiles: DiscoveryResult['conventions']
): string {
  const steps: string[] = []

  if (conventionFiles.length === 0 && analysis.checks.rules) {
    steps.push(`reading ${config.rulesFile}`)
  }

  if (analysis.checks.lint && lintCmd) {
    steps.push(`running \`${lintCmd}\``)
  } else {
    steps.push(`running \`${config.commands.typecheck}\``)
  }

  return `Start by ${steps.join(', then ')}.`
}
