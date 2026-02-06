/**
 * BULLETPROOF Configuration
 *
 * Configuration types and loading for the pre-push guardian.
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Coverage threshold configuration
 */
export interface CoverageThresholds {
  lines: number
  statements: number
  functions: number
  branches: number
}

/**
 * Check configuration - which checks to run
 */
export interface ChecksConfig {
  /** Run rules compliance check against project conventions */
  rules: boolean
  /** Run linting (discovered from package.json) */
  lint: boolean
  /** Run formatting check (discovered from package.json) */
  format: boolean
  /** Run TypeScript type checking */
  typecheck: boolean
  /** Run build (discovered from package.json) */
  build: boolean
  /** Run test suite */
  tests: boolean
  /** Run coverage analysis */
  coverage: boolean
}

/**
 * Commands configuration - npm scripts to run for each check
 */
export interface CommandsConfig {
  /** Command to run lint (auto-discovered or manual) */
  lint: string | null
  /** Command to run format check (auto-discovered or manual) */
  format: string | null
  /** Command to run typecheck (default: npm run typecheck) */
  typecheck: string
  /** Command to run build (auto-discovered or manual) */
  build: string | null
  /** Command to run tests (default: npm run test) */
  test: string
  /** Command to run tests with coverage (default: npm run test:coverage:ci) */
  testCoverage: string
  /** Command to run related tests only (default: npm run test:related) */
  testRelated: string
  /** Command to run related tests with coverage (default: npm run test:coverage:related) */
  testCoverageRelated: string
}

/**
 * Convention discovery configuration
 */
export interface ConventionsConfig {
  /** Maximum size per convention file in bytes (default: 100KB) */
  maxFileSize: number
  /** Maximum combined size of all convention files in bytes (default: 200KB) */
  maxCombinedSize: number
  /** Whether to include source markers when combining files (default: true) */
  includeSourceMarkers: boolean
}

/**
 * Discovery configuration
 */
export interface DiscoveryConfig {
  /** Convention file discovery settings */
  conventions: ConventionsConfig
  /** Whether to auto-discover scripts from package.json (default: true) */
  autoDiscoverScripts: boolean
}

/**
 * Coverage scope configuration - patterns for files that require coverage
 */
export interface CoverageScopeConfig {
  /** Glob patterns for files that should be included in coverage */
  include: string[]
  /** Glob patterns for files that should be excluded from coverage */
  exclude: string[]
}

/**
 * Full BULLETPROOF configuration
 */
export interface BulletproofConfig {
  /** Claude model to use (default: claude-opus-4-6) */
  model: string

  /** Maximum number of Claude turns for fixing issues (default: 50) */
  maxTurns: number

  /** Coverage thresholds */
  coverageThresholds: CoverageThresholds

  /** Coverage scope patterns */
  coverageScope: CoverageScopeConfig

  /** Default checks to run */
  checks: ChecksConfig

  /** Commands to run for each check */
  commands: CommandsConfig

  /**
   * Path to rules file (default: .cursorrules)
   * @deprecated Use discovery.conventions instead - convention files are now auto-discovered
   */
  rulesFile: string

  /** Discovery configuration */
  discovery: DiscoveryConfig

  /** System prompt customization */
  systemPrompt?: string

  /** Additional prompt instructions */
  additionalInstructions?: string
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: BulletproofConfig = {
  model: 'claude-opus-4-6',
  maxTurns: 50,
  coverageThresholds: {
    lines: 90,
    statements: 90,
    functions: 78,
    branches: 80,
  },
  coverageScope: {
    include: [
      'src/**/*.ts',
      'src/**/*.tsx',
    ],
    exclude: [
      'src/test/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/types/**',
      '**/*.d.ts',
    ],
  },
  checks: {
    rules: true,
    lint: true,
    format: true,
    typecheck: true,
    build: true,
    tests: true,
    coverage: true,
  },
  commands: {
    lint: null, // Auto-discovered from package.json
    format: null, // Auto-discovered from package.json
    typecheck: 'npm run typecheck',
    build: null, // Auto-discovered from package.json
    test: 'npm run test',
    testCoverage: 'npm run test:coverage:ci',
    testRelated: 'npm run test:related',
    testCoverageRelated: 'npm run test:coverage:related',
  },
  rulesFile: '.cursorrules', // Deprecated - use discovery.conventions
  discovery: {
    conventions: {
      maxFileSize: 100 * 1024, // 100KB
      maxCombinedSize: 200 * 1024, // 200KB
      includeSourceMarkers: true,
    },
    autoDiscoverScripts: true,
  },
}

/**
 * Configuration file names to search for
 */
const CONFIG_FILE_NAMES = [
  'bulletproof.config.json',
  'bulletproof.config.js',
  '.bulletproofrc',
  '.bulletproofrc.json',
]

/**
 * Load configuration from file if it exists
 */
export function loadConfigFile(cwd: string): Partial<BulletproofConfig> | null {
  for (const fileName of CONFIG_FILE_NAMES) {
    const filePath = resolve(cwd, fileName)
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8')
        return JSON.parse(content) as Partial<BulletproofConfig>
      } catch {
        // Ignore parse errors, continue to next file
      }
    }
  }

  // Check package.json for bulletproof config
  const pkgPath = resolve(cwd, 'package.json')
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      if (pkg.bulletproof) {
        return pkg.bulletproof as Partial<BulletproofConfig>
      }
    } catch {
      // Ignore parse errors
    }
  }

  return null
}

/**
 * Merge partial config with defaults
 */
export function mergeConfig(
  partial: Partial<BulletproofConfig> | null,
  defaults: BulletproofConfig = DEFAULT_CONFIG
): BulletproofConfig {
  if (!partial) {
    return { ...defaults }
  }

  return {
    model: partial.model ?? defaults.model,
    maxTurns: partial.maxTurns ?? defaults.maxTurns,
    coverageThresholds: {
      ...defaults.coverageThresholds,
      ...partial.coverageThresholds,
    },
    coverageScope: {
      include: partial.coverageScope?.include ?? defaults.coverageScope.include,
      exclude: partial.coverageScope?.exclude ?? defaults.coverageScope.exclude,
    },
    checks: {
      ...defaults.checks,
      ...partial.checks,
    },
    commands: {
      ...defaults.commands,
      ...partial.commands,
    },
    rulesFile: partial.rulesFile ?? defaults.rulesFile,
    discovery: {
      conventions: {
        ...defaults.discovery.conventions,
        ...partial.discovery?.conventions,
      },
      autoDiscoverScripts:
        partial.discovery?.autoDiscoverScripts ??
        defaults.discovery.autoDiscoverScripts,
    },
    systemPrompt: partial.systemPrompt,
    additionalInstructions: partial.additionalInstructions,
  }
}

/**
 * Load and merge configuration for a project
 */
export function loadConfig(cwd: string = process.cwd()): BulletproofConfig {
  const fileConfig = loadConfigFile(cwd)
  return mergeConfig(fileConfig)
}

/**
 * Check if a file matches coverage scope patterns
 */
export function isInCoverageScope(
  file: string,
  scope: CoverageScopeConfig
): boolean {
  // Convert glob patterns to regex for matching
  const toRegex = (pattern: string): RegExp => {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '<<<GLOBSTAR>>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<<GLOBSTAR>>>/g, '.*')
    return new RegExp(`^${escaped}$`)
  }

  // Check if file matches any include pattern
  const matchesInclude = scope.include.some((pattern) =>
    toRegex(pattern).test(file)
  )

  if (!matchesInclude) {
    return false
  }

  // Check if file matches any exclude pattern
  const matchesExclude = scope.exclude.some((pattern) =>
    toRegex(pattern).test(file)
  )

  return !matchesExclude
}
