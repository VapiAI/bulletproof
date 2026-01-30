/**
 * Husky setup utilities
 */

import { execSync } from 'child_process'
import { existsSync, mkdirSync, writeFileSync, chmodSync, readFileSync } from 'fs'
import { resolve } from 'path'
import type { PackageManager, StepResult } from './types.js'

/**
 * Get install command for package manager
 */
function getInstallCommand(pm: PackageManager, pkg: string, dev = true): string {
  switch (pm) {
    case 'yarn':
      return `yarn add ${dev ? '-D' : ''} ${pkg}`
    case 'pnpm':
      return `pnpm add ${dev ? '-D' : ''} ${pkg}`
    case 'bun':
      return `bun add ${dev ? '-d' : ''} ${pkg}`
    default:
      return `npm install ${dev ? '--save-dev' : ''} ${pkg}`
  }
}

/**
 * Get exec command prefix for package manager
 */
function getExecCommand(pm: PackageManager): string {
  switch (pm) {
    case 'yarn':
      return 'yarn'
    case 'pnpm':
      return 'pnpm exec'
    case 'bun':
      return 'bunx'
    default:
      return 'npx'
  }
}

/**
 * Check if husky is installed in package.json
 */
function isHuskyInstalled(cwd: string): boolean {
  const pkgPath = resolve(cwd, 'package.json')
  if (!existsSync(pkgPath)) {
    return false
  }
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    return !!(pkg.devDependencies?.husky || pkg.dependencies?.husky)
  } catch {
    return false
  }
}

/**
 * Pre-push hook content
 */
const PRE_PUSH_HOOK = `#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx bulletproof run --hook
`

/**
 * Install husky and set up pre-push hook
 */
export async function setupHusky(
  cwd: string,
  pm: PackageManager,
  options: { verbose?: boolean } = {}
): Promise<StepResult> {
  const huskyDir = resolve(cwd, '.husky')
  const prePushPath = resolve(huskyDir, 'pre-push')

  try {
    // Check if .husky directory already exists with pre-push hook
    if (existsSync(prePushPath)) {
      // Check if it already contains bulletproof
      const content = readFileSync(prePushPath, 'utf-8')
      if (content.includes('bulletproof')) {
        return {
          success: true,
          message: 'Husky pre-push hook already configured for bulletproof',
          skipped: true,
        }
      }
      // Append bulletproof to existing hook
      const updatedContent = content.trimEnd() + '\n\nnpx bulletproof run --hook\n'
      writeFileSync(prePushPath, updatedContent)
      return {
        success: true,
        message: 'Added bulletproof to existing pre-push hook',
      }
    }

    // Install husky if not already installed
    if (!isHuskyInstalled(cwd)) {
      const installCmd = getInstallCommand(pm, 'husky')
      if (options.verbose) {
        console.log(`Installing husky: ${installCmd}`)
      }
      execSync(installCmd, { cwd, stdio: options.verbose ? 'inherit' : 'pipe' })
    }

    // Initialize husky
    const execCmd = getExecCommand(pm)
    const initCmd = `${execCmd} husky init`
    if (options.verbose) {
      console.log(`Initializing husky: ${initCmd}`)
    }

    try {
      execSync(initCmd, { cwd, stdio: options.verbose ? 'inherit' : 'pipe' })
    } catch {
      // husky init might fail if .husky already exists, try manual setup
      if (!existsSync(huskyDir)) {
        mkdirSync(huskyDir, { recursive: true })
      }
    }

    // Create pre-push hook
    writeFileSync(prePushPath, PRE_PUSH_HOOK)
    chmodSync(prePushPath, '755')

    // Remove the default pre-commit hook if it exists and is the default one
    const preCommitPath = resolve(huskyDir, 'pre-commit')
    if (existsSync(preCommitPath)) {
      const preCommitContent = readFileSync(preCommitPath, 'utf-8')
      // Only remove if it's the default "npm test" hook
      if (preCommitContent.includes('npm test') && !preCommitContent.includes('bulletproof')) {
        // Leave it alone, user might want it
      }
    }

    return {
      success: true,
      message: 'Husky installed and pre-push hook created',
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      message: 'Failed to set up husky',
      error: errorMessage,
    }
  }
}

/**
 * Verify husky setup
 */
export function verifyHuskySetup(cwd: string): boolean {
  const prePushPath = resolve(cwd, '.husky', 'pre-push')
  if (!existsSync(prePushPath)) {
    return false
  }
  const content = readFileSync(prePushPath, 'utf-8')
  return content.includes('bulletproof')
}
