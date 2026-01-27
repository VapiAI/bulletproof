/**
 * BULLETPROOF - Git utilities
 */

import { execSync } from 'child_process'

/**
 * Check if there are uncommitted changes
 */
export function hasUncommittedChanges(cwd: string = process.cwd()): boolean {
  try {
    const status = execSync('git status --porcelain', {
      encoding: 'utf-8',
      cwd,
    })
    return status.trim().length > 0
  } catch {
    return false
  }
}

/**
 * Result of pulling and merging from main
 */
export interface MergeResult {
  success: boolean
  hasConflicts: boolean
  error?: string
}

/**
 * Pull from origin main and check for merge conflicts
 */
export function pullAndMergeMain(
  cwd: string = process.cwd(),
  agentMode: boolean = false,
  log: (msg: string) => void = console.log
): MergeResult {
  try {
    // Fetch latest from origin
    if (agentMode) {
      log('[GIT] Syncing with origin/main...')
    } else {
      log('  ↓  Syncing with origin/main...')
    }
    execSync('git fetch origin main', { stdio: 'pipe', cwd })

    // Check if we're behind main
    const behindCount = execSync('git rev-list --count HEAD..origin/main', {
      encoding: 'utf-8',
      cwd,
    }).trim()

    if (behindCount === '0') {
      if (agentMode) {
        log('[GIT] Already synced with main')
      } else {
        log('  ●  Already synced with main')
      }
      return { success: true, hasConflicts: false }
    }

    if (agentMode) {
      log(`[GIT] ${behindCount} commits behind — merging...`)
    } else {
      log(`  ↓  ${behindCount} commits behind — merging...`)
    }

    // Try to merge
    try {
      execSync('git merge origin/main --no-edit', { stdio: 'pipe', cwd })
      if (agentMode) {
        log('[GIT] Merged successfully')
      } else {
        log('  ●  Merged successfully')
      }
      return { success: true, hasConflicts: false }
    } catch {
      // Check if there are merge conflicts
      const status = execSync('git status --porcelain', {
        encoding: 'utf-8',
        cwd,
      })
      if (
        status.includes('UU') ||
        status.includes('AA') ||
        status.includes('DD')
      ) {
        if (agentMode) {
          log('[GIT] Conflicts detected — Claude will resolve')
        } else {
          log('  ⚠  Conflicts detected — Claude will resolve')
        }
        return { success: false, hasConflicts: true }
      }
      throw new Error('Merge failed')
    }
  } catch (e) {
    const error = e as Error
    return { success: false, hasConflicts: false, error: error.message }
  }
}

/**
 * Commit any pending changes with auto-fix message
 */
export function commitFixes(
  cwd: string = process.cwd(),
  agentMode: boolean = false,
  log: (msg: string) => void = console.log
): boolean {
  if (!hasUncommittedChanges(cwd)) return false

  try {
    execSync('git add -A', { stdio: 'pipe', cwd })
    // Skip commit message generation for auto-fix commits
    execSync('git commit -m "fix: auto-fix from BULLETPROOF" --no-verify', {
      stdio: 'pipe',
      cwd,
      env: { ...process.env, SKIP_COMMIT_MSG_GEN: '1' },
    })
    if (agentMode) {
      log('[GIT] Auto-fix committed')
    } else {
      log('  ●  Auto-fix committed')
    }
    return true
  } catch (e) {
    console.error('Failed to commit:', e)
    return false
  }
}

/**
 * Push to remote with --no-verify
 */
export function pushToRemote(
  cwd: string = process.cwd(),
  agentMode: boolean = false,
  log: (msg: string) => void = console.log
): boolean {
  try {
    if (agentMode) {
      log('[GIT] Pushing to remote...')
    } else {
      log('  Pushing to remote...')
    }
    execSync('git push --no-verify', { stdio: 'inherit', cwd })
    if (agentMode) {
      log('[SUCCESS] Pushed successfully')
    } else {
      log('  ●  Pushed successfully')
    }
    return true
  } catch {
    if (agentMode) {
      log('[FAILED] Push failed')
    } else {
      log('  ○  Push failed')
    }
    return false
  }
}

/**
 * Get list of changed files
 */
export function getChangedFiles(cwd: string = process.cwd()): string[] {
  try {
    const output = execSync(
      'git diff HEAD~1 --name-only 2>/dev/null || git diff --cached --name-only',
      { encoding: 'utf-8', cwd }
    )
    return output
      .trim()
      .split('\n')
      .filter((f) => f.length > 0)
  } catch {
    return []
  }
}

/**
 * Get diff stats (additions and deletions)
 */
export function getDiffStats(
  cwd: string = process.cwd()
): { additions: number; deletions: number } {
  try {
    const output = execSync(
      'git diff HEAD~1 --shortstat 2>/dev/null || git diff --cached --shortstat',
      { encoding: 'utf-8', cwd }
    )
    const match = output.match(/(\d+) insertion.*?(\d+) deletion/)
    if (match) {
      return {
        additions: parseInt(match[1], 10),
        deletions: parseInt(match[2], 10),
      }
    }
  } catch {
    // Ignore errors
  }
  return { additions: 0, deletions: 0 }
}
