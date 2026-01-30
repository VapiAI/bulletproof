/**
 * BULLETPROOF - Script discovery from package.json
 *
 * Discovers available CI check scripts (lint, typecheck, build, format)
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

/**
 * Check category types (tests excluded - handled separately)
 */
export type CheckCategory = 'lint' | 'typecheck' | 'build' | 'format'

/**
 * Package manager types
 */
export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun'

/**
 * Discovered script
 */
export interface DiscoveredScript {
  /** Script name from package.json */
  name: string
  /** Script command */
  command: string
  /** Detected category */
  category: CheckCategory
  /** Full command to run (with package manager) */
  runCommand: string
}

/**
 * Script discovery result
 */
export interface ScriptDiscoveryResult {
  /** Detected package manager */
  packageManager: PackageManager
  /** Discovered scripts by category */
  scripts: Record<CheckCategory, DiscoveredScript | null>
  /** All discovered scripts (including duplicates) */
  allScripts: DiscoveredScript[]
}

/**
 * Check execution order
 */
export const CHECK_EXECUTION_ORDER: readonly CheckCategory[] = [
  'lint',
  'format',
  'typecheck',
  'build',
] as const

/**
 * Script name patterns for each category
 *
 * Format: { exact: string[], prefix: string[] }
 * - exact: Match script name exactly
 * - prefix: Match script name starting with this prefix
 */
const SCRIPT_PATTERNS: Record<
  CheckCategory,
  { exact: string[]; prefix: string[] }
> = {
  lint: {
    exact: ['lint', 'eslint'],
    prefix: ['lint:'],
  },
  typecheck: {
    exact: ['typecheck', 'type-check', 'tsc', 'types'],
    prefix: ['typecheck:', 'type-check:'],
  },
  build: {
    exact: ['build', 'compile'],
    prefix: ['build:'],
  },
  format: {
    exact: ['format', 'prettier', 'fmt'],
    prefix: ['format:'],
  },
}

/**
 * Blacklisted script patterns (never discover these)
 */
const BLACKLIST_PATTERNS: Array<string | RegExp> = [
  // Watch/dev scripts
  /watch/i,
  /dev$/i,
  /:dev$/i,
  /^dev:/i,
  // Fix scripts (auto-fixing should be explicit)
  /:fix$/i,
  /fix$/i,
  // CI-specific scripts (may have different behavior)
  /:ci$/i,
  // Preview/serve scripts
  /preview/i,
  /serve/i,
  // Install scripts
  /install/i,
  /postinstall/i,
  /preinstall/i,
  // Specific dangerous patterns
  'lint-staged',
  'husky',
  'prepare',
  'prepublish',
  'prepublishOnly',
]

/**
 * Check if a script name matches a blacklist pattern
 */
export function isBlacklisted(scriptName: string): boolean {
  return BLACKLIST_PATTERNS.some((pattern) => {
    if (typeof pattern === 'string') {
      return scriptName === pattern
    }
    return pattern.test(scriptName)
  })
}

/**
 * Categorize a script name
 */
export function categorizeScript(
  scriptName: string
): CheckCategory | null {
  if (isBlacklisted(scriptName)) {
    return null
  }

  const lowerName = scriptName.toLowerCase()

  for (const category of CHECK_EXECUTION_ORDER) {
    const patterns = SCRIPT_PATTERNS[category]

    // Check exact matches first
    if (patterns.exact.includes(lowerName)) {
      return category
    }

    // Check prefix matches
    for (const prefix of patterns.prefix) {
      if (lowerName.startsWith(prefix)) {
        return category
      }
    }
  }

  return null
}

/**
 * Detect package manager from lockfile
 */
export function detectPackageManager(cwd: string): PackageManager {
  // Check in order of preference
  if (existsSync(join(cwd, 'bun.lockb'))) {
    return 'bun'
  }
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }
  if (existsSync(join(cwd, 'yarn.lock'))) {
    return 'yarn'
  }
  // Default to npm
  return 'npm'
}

/**
 * Get the run command for a package manager
 */
function getRunCommand(pm: PackageManager, scriptName: string): string {
  switch (pm) {
    case 'npm':
      return `npm run ${scriptName}`
    case 'yarn':
      return `yarn ${scriptName}`
    case 'pnpm':
      return `pnpm run ${scriptName}`
    case 'bun':
      return `bun run ${scriptName}`
  }
}

/**
 * Discover scripts from package.json
 */
export function discoverScripts(cwd: string): ScriptDiscoveryResult {
  const packageManager = detectPackageManager(cwd)

  const result: ScriptDiscoveryResult = {
    packageManager,
    scripts: {
      lint: null,
      typecheck: null,
      build: null,
      format: null,
    },
    allScripts: [],
  }

  const packageJsonPath = join(cwd, 'package.json')
  if (!existsSync(packageJsonPath)) {
    return result
  }

  let packageJson: { scripts?: Record<string, string> }
  try {
    const content = readFileSync(packageJsonPath, 'utf-8')
    packageJson = JSON.parse(content)
  } catch {
    return result
  }

  const scripts = packageJson.scripts || {}

  // Process scripts in deterministic order
  const scriptNames = Object.keys(scripts).sort()

  for (const scriptName of scriptNames) {
    const category = categorizeScript(scriptName)
    if (!category) {
      continue
    }

    const command = scripts[scriptName]
    const runCommand = getRunCommand(packageManager, scriptName)

    const discovered: DiscoveredScript = {
      name: scriptName,
      command,
      category,
      runCommand,
    }

    result.allScripts.push(discovered)

    // Only keep the first (best) match for each category
    // Prefer exact matches (shorter names) over prefixed ones
    if (!result.scripts[category]) {
      result.scripts[category] = discovered
    } else {
      // Prefer exact match over prefix match
      const existing = result.scripts[category]
      const existingIsExact = SCRIPT_PATTERNS[category].exact.includes(
        existing.name.toLowerCase()
      )
      const newIsExact = SCRIPT_PATTERNS[category].exact.includes(
        scriptName.toLowerCase()
      )

      if (newIsExact && !existingIsExact) {
        result.scripts[category] = discovered
      }
    }
  }

  return result
}

/**
 * Get the ordered list of checks to run
 */
export function getOrderedChecks(
  discovery: ScriptDiscoveryResult
): DiscoveredScript[] {
  const ordered: DiscoveredScript[] = []

  for (const category of CHECK_EXECUTION_ORDER) {
    const script = discovery.scripts[category]
    if (script) {
      ordered.push(script)
    }
  }

  return ordered
}

/**
 * Check if a specific check category is available
 */
export function hasCheck(
  discovery: ScriptDiscoveryResult,
  category: CheckCategory
): boolean {
  return discovery.scripts[category] !== null
}

/**
 * Get the run command for a specific check category
 */
export function getCheckCommand(
  discovery: ScriptDiscoveryResult,
  category: CheckCategory
): string | null {
  const script = discovery.scripts[category]
  return script ? script.runCommand : null
}
