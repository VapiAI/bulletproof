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
  /** Run TypeScript type checking */
  typecheck: boolean
  /** Run test suite */
  tests: boolean
  /** Run coverage analysis */
  coverage: boolean
}

/**
 * Commands configuration - npm scripts to run for each check
 */
export interface CommandsConfig {
  /** Command to run typecheck (default: npm run typecheck) */
  typecheck: string
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
 * Pattern that can be either a glob string or a regex pattern string
 * Regex patterns should be prefixed with "regex:" (e.g., "regex:^src/app/.*\\.(ts|tsx)$")
 */
export type CoveragePattern = string

/**
 * Coverage scope configuration - patterns for files that require coverage
 */
export interface CoverageScopeConfig {
  /**
   * Patterns for files that should be included in coverage.
   * Can be glob patterns (e.g., "src/**\/*.ts") or regex patterns prefixed with "regex:"
   * (e.g., "regex:^src/app/.*\\.(ts|tsx)$")
   */
  include: CoveragePattern[]
  /**
   * Patterns for files that should be excluded from coverage.
   * Can be glob patterns or regex patterns prefixed with "regex:"
   */
  exclude: CoveragePattern[]
}

/**
 * Preset configurations for common project types
 */
export type CoveragePreset = 'default' | 'vapi-nextjs'

/**
 * Vapi Next.js preset coverage scope patterns (matching atlas implementation)
 */
export const VAPI_NEXTJS_COVERAGE_SCOPE: CoverageScopeConfig = {
  include: [
    'regex:^src/app/.*\\.(ts|tsx)$',
    'regex:^src/components/.*\\.(ts|tsx)$',
    'regex:^src/hooks/.*\\.(ts|tsx)$',
    'regex:^src/lib/.*\\.ts$',
  ],
  exclude: [
    'regex:^src/test/',
    'regex:\\.test\\.(ts|tsx)$',
    'regex:\\.spec\\.(ts|tsx)$',
    'regex:/types/',
    'regex:\\.d\\.ts$',
    'regex:/layout\\.tsx$',
    'regex:/page\\.tsx$',
    'regex:^src/components/ui/[^/]+\\.tsx$',
    'regex:^src/lib/api/generate-mcp-tools\\.ts$',
    'regex:/index\\.ts$',
    'regex:^src/app/api/auth/\\[\\.\\.\\.nextauth\\]/route\\.ts$',
  ],
}

/**
 * Detailed rules guidance for the Claude agent
 * These provide specific conventions for different file types
 */
export interface RulesGuidance {
  /** Rules for API routes */
  apiRoutes?: string[]
  /** Rules for React components */
  reactComponents?: string[]
  /** Rules for hooks */
  hooks?: string[]
  /** Rules for test files */
  testFiles?: string[]
  /** Rules for all files */
  allFiles?: string[]
}

/**
 * Full BULLETPROOF configuration
 */
export interface BulletproofConfig {
  /** Claude model to use (default: claude-opus-4-5-20251101) */
  model: string

  /** Maximum number of Claude turns for fixing issues (default: 50) */
  maxTurns: number

  /** Coverage thresholds */
  coverageThresholds: CoverageThresholds

  /** Coverage scope patterns */
  coverageScope: CoverageScopeConfig

  /** Use a preset for coverage scope (overrides coverageScope if set) */
  coveragePreset?: CoveragePreset

  /** Default checks to run */
  checks: ChecksConfig

  /** Commands to run for each check */
  commands: CommandsConfig

  /** Path to rules file (default: .cursorrules) */
  rulesFile: string

  /** System prompt customization */
  systemPrompt?: string

  /** Additional prompt instructions */
  additionalInstructions?: string

  /** Detailed rules guidance for different file types */
  rulesGuidance?: RulesGuidance
}

/**
 * Default Vapi-specific rules guidance (matching atlas implementation)
 */
export const DEFAULT_VAPI_RULES_GUIDANCE: RulesGuidance = {
  apiRoutes: [
    'Uses `authenticateRequestWithPermissions` for auth',
    'Emits SSE events for all create/update/delete operations (`emitEvent`)',
    'Returns proper HTTP status codes (200, 201, 400, 401, 403, 404, 500)',
    'Has corresponding tests in src/test/api/',
  ],
  reactComponents: [
    'Uses existing UI components from src/components/ui/ (Button, Card, Badge, etc.)',
    'Uses `cn()` for className merging',
    'Uses `@/` path aliases (never relative imports like ../../)',
    'Loading states use skeleton components',
    'Detail/nested pages use `DetailPageHeader` with back button',
    'Mutations use `useOptimisticMutation` hook',
    'Links prefetch on hover',
  ],
  hooks: [
    'Custom hooks follow use* naming convention',
    'Uses proper TypeScript types (no `any`)',
  ],
  testFiles: [
    'Located in src/test/ mirroring source path',
    'Tests auth (401), validation (400), happy path, and error cases',
    'Uses vi.mock() before imports',
    'Has beforeEach with vi.resetAllMocks()',
  ],
  allFiles: [
    'No hardcoded values (use constants)',
    'Console logs use context prefixes like [API], [SSE], [Auth]',
    'TypeScript types are explicit (no `any`)',
    'Import order follows: React > Next > External > Internal hooks > Components > Utils > Types',
  ],
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: BulletproofConfig = {
  model: 'claude-opus-4-5-20251101',
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
    typecheck: true,
    tests: true,
    coverage: true,
  },
  commands: {
    typecheck: 'npm run typecheck',
    test: 'npm run test',
    testCoverage: 'npm run test:coverage:ci',
    testRelated: 'npm run test:related',
    testCoverageRelated: 'npm run test:coverage:related',
  },
  rulesFile: '.cursorrules',
  rulesGuidance: DEFAULT_VAPI_RULES_GUIDANCE,
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
 * Get coverage scope based on preset or explicit config
 */
function getCoverageScope(
  partial: Partial<BulletproofConfig> | null,
  defaults: BulletproofConfig
): CoverageScopeConfig {
  // If preset is specified, use it
  if (partial?.coveragePreset === 'vapi-nextjs') {
    return VAPI_NEXTJS_COVERAGE_SCOPE
  }

  // Otherwise use explicit config or defaults
  return {
    include: partial?.coverageScope?.include ?? defaults.coverageScope.include,
    exclude: partial?.coverageScope?.exclude ?? defaults.coverageScope.exclude,
  }
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
    coverageScope: getCoverageScope(partial, defaults),
    coveragePreset: partial.coveragePreset,
    checks: {
      ...defaults.checks,
      ...partial.checks,
    },
    commands: {
      ...defaults.commands,
      ...partial.commands,
    },
    rulesFile: partial.rulesFile ?? defaults.rulesFile,
    systemPrompt: partial.systemPrompt,
    additionalInstructions: partial.additionalInstructions,
    rulesGuidance: partial.rulesGuidance ?? defaults.rulesGuidance,
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
 * Convert a coverage pattern (glob or regex) to a RegExp
 */
function patternToRegex(pattern: CoveragePattern): RegExp {
  // Check if it's a regex pattern (prefixed with "regex:")
  if (pattern.startsWith('regex:')) {
    return new RegExp(pattern.slice(6))
  }

  // Otherwise, convert glob to regex
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '<<<GLOBSTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<GLOBSTAR>>>/g, '.*')
  return new RegExp(`^${escaped}$`)
}

/**
 * Check if a file matches coverage scope patterns
 */
export function isInCoverageScope(
  file: string,
  scope: CoverageScopeConfig
): boolean {
  // Check if file matches any include pattern
  const matchesInclude = scope.include.some((pattern) =>
    patternToRegex(pattern).test(file)
  )

  if (!matchesInclude) {
    return false
  }

  // Check if file matches any exclude pattern
  const matchesExclude = scope.exclude.some((pattern) =>
    patternToRegex(pattern).test(file)
  )

  return !matchesExclude
}
