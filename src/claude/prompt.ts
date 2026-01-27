/**
 * BULLETPROOF - Prompt generation for Claude Agent SDK
 */

import type { DiffAnalysis } from '../diff/analyzer.js'
import type { BulletproofConfig } from '../config.js'

/**
 * Generate the system prompt for Claude
 */
export function generateSystemPrompt(config: BulletproofConfig): string {
  const base = `You are an expert TypeScript/React developer running pre-push checks and ensuring code follows project conventions.
You are working in the current directory - DO NOT cd to any other directory.
Your goals are:
1. Make all checks pass (typecheck, tests, coverage)
2. Ensure ALL changed files comply with project conventions in ${config.rulesFile}

Be systematic: run checks, analyze failures, fix issues, verify fixes, repeat.
ALWAYS read ${config.rulesFile} FIRST (use cat ${config.rulesFile}) - it contains ALL the conventions your code MUST follow.
After checks pass, review changed files against ${config.rulesFile} and fix any violations.
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
  hasConflicts: boolean
): string {
  const checksToRun: string[] = []
  const checksToSkip: string[] = []

  if (analysis.checks.rules) {
    checksToRun.push(
      `1. **RULES COMPLIANCE CHECK**: Review changed files against ${config.rulesFile}`
    )
  } else {
    checksToSkip.push('Rules compliance (docs only)')
  }

  if (analysis.checks.typecheck) {
    checksToRun.push(
      `${checksToRun.length + 1}. Run \`${config.commands.typecheck}\` - fix ALL type errors`
    )
  } else {
    checksToSkip.push('Typecheck (no code changes)')
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

  const prompt = `You are running pre-push checks for THIS project in the current working directory.
${skipSection}
${mergeConflictPrompt}
## ${hasConflicts ? 'THEN' : 'FIRST'}: Read the project rules
${analysis.checks.rules ? `Run \`cat ${config.rulesFile}\` and read the entire file carefully. This contains ALL project conventions, patterns, and rules that your changes MUST follow.` : `Skip reading ${config.rulesFile} for this docs-only change.`}

## Your Task (in order):
${checksToRun.join('\n')}

${coverageInstructions}

## RULES COMPLIANCE CHECK (Step 1):
Run \`git diff HEAD~1 --name-only\` to see changed files, then review them against ${config.rulesFile}:

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

## IMPORTANT - Report results after EVERY command:

After typecheck, report:
✓ TYPECHECK PASSED  or  ✗ TYPECHECK FAILED (X errors)

After tests, report:
✓ TESTS: X passed, Y failed, Z skipped  or  ✗ TESTS FAILED: X passed, Y failed

After coverage, report ALL FOUR metrics:
📊 COVERAGE: Lines X% | Statements X% | Functions X% | Branches X%
Then note if each meets threshold: Lines ≥${thresholds.lines}%, Statements ≥${thresholds.statements}%, Functions ≥${thresholds.functions}%, Branches ≥${thresholds.branches}%

## SPEED TIPS:
- Rules check is fast - review changed files first to catch convention issues early
- typecheck is fast (~30s) - fix all type errors before running tests
- \`${config.commands.test}\` is faster than ${config.commands.testCoverage} - use it to verify test fixes
- Only run the full coverage check when you think everything should pass

## FIXING ISSUES:
- DO fix any test failures you encounter, even if unrelated to this PR
- DO fix any typecheck errors, even if unrelated
- But for COVERAGE specifically, use the "BE SMART ABOUT COVERAGE" rules above
- Coverage is different - don't try to add tests for old code just to hit thresholds

## Before making code changes:
1. Re-read relevant sections of ${config.rulesFile} for the specific patterns
2. Look at similar existing files for patterns

## Rules:
- Make minimal changes - fix only what's broken
- Follow existing code patterns exactly
- For test files, copy patterns from similar existing tests

## When finished:
- If all checks AND rules compliance pass, say "ALL CHECKS PASSED"
- If stuck, explain what's blocking you
${config.additionalInstructions ? `\n## Additional Instructions:\n${config.additionalInstructions}` : ''}

Start by reading ${config.rulesFile}, then run \`${config.commands.typecheck}\`.`

  return prompt
}
