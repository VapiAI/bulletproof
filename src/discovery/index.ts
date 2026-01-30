/**
 * BULLETPROOF - Discovery module
 *
 * Discovers project conventions and available CI scripts
 */

// Re-export convention discovery
export {
  type ConventionType,
  type ConventionFile,
  type ConventionDiscoveryConfig,
  DEFAULT_CONVENTION_CONFIG,
  loadFileContent,
  deduplicateContent,
  combineConventions,
  discoverConventionFiles,
  getConventionsForPrompt,
} from './conventions.js'

// Re-export script discovery
export {
  type CheckCategory,
  type PackageManager,
  type DiscoveredScript,
  type ScriptDiscoveryResult,
  CHECK_EXECUTION_ORDER,
  isBlacklisted,
  categorizeScript,
  detectPackageManager,
  discoverScripts,
  getOrderedChecks,
  hasCheck,
  getCheckCommand,
} from './scripts.js'

import type { ConventionFile, ConventionDiscoveryConfig } from './conventions.js'
import type { ScriptDiscoveryResult } from './scripts.js'
import { discoverConventionFiles, DEFAULT_CONVENTION_CONFIG } from './conventions.js'
import { discoverScripts } from './scripts.js'

/**
 * Combined discovery result
 */
export interface DiscoveryResult {
  /** Discovered convention files */
  conventions: ConventionFile[]
  /** Discovered scripts */
  scripts: ScriptDiscoveryResult
}

/**
 * Discovery configuration
 */
export interface DiscoveryConfig {
  /** Convention discovery configuration */
  conventions: Partial<ConventionDiscoveryConfig>
  /** Whether to discover scripts (default: true) */
  discoverScripts: boolean
}

/**
 * Default discovery configuration
 */
export const DEFAULT_DISCOVERY_CONFIG: DiscoveryConfig = {
  conventions: DEFAULT_CONVENTION_CONFIG,
  discoverScripts: true,
}

/**
 * Run full discovery for a project
 */
export function runDiscovery(
  cwd: string,
  config: Partial<DiscoveryConfig> = {}
): DiscoveryResult {
  const finalConfig: DiscoveryConfig = {
    ...DEFAULT_DISCOVERY_CONFIG,
    ...config,
    conventions: {
      ...DEFAULT_CONVENTION_CONFIG,
      ...config.conventions,
    },
  }

  const conventions = discoverConventionFiles(cwd, finalConfig.conventions)

  const scripts = finalConfig.discoverScripts
    ? discoverScripts(cwd)
    : {
        packageManager: 'npm' as const,
        scripts: {
          lint: null,
          typecheck: null,
          build: null,
          format: null,
        },
        allScripts: [],
      }

  return {
    conventions,
    scripts,
  }
}

/**
 * Format discovery results for logging
 */
export function formatDiscoverySummary(result: DiscoveryResult): string {
  const lines: string[] = []

  // Convention files
  if (result.conventions.length > 0) {
    lines.push(`Convention files: ${result.conventions.length}`)
    for (const file of result.conventions) {
      const sizeKb = (file.size / 1024).toFixed(1)
      lines.push(`  - ${file.type}: ${file.path} (${sizeKb}KB)`)
    }
  } else {
    lines.push('Convention files: none found')
  }

  // Scripts
  lines.push(`Package manager: ${result.scripts.packageManager}`)
  lines.push('Discovered checks:')

  const categories = ['lint', 'typecheck', 'build', 'format'] as const
  for (const category of categories) {
    const script = result.scripts.scripts[category]
    if (script) {
      lines.push(`  - ${category}: ${script.runCommand}`)
    } else {
      lines.push(`  - ${category}: not found`)
    }
  }

  return lines.join('\n')
}
