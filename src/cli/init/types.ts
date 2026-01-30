/**
 * Types for the init wizard
 */

/**
 * Supported project types
 */
export type ProjectType =
  | 'next'
  | 'nestjs'
  | 'react'
  | 'express'
  | 'node'
  | 'unknown'

/**
 * Supported package managers
 */
export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun'

/**
 * Project detection result
 */
export interface ProjectInfo {
  type: ProjectType
  packageManager: PackageManager
  hasTypeScript: boolean
  hasVitest: boolean
  hasJest: boolean
  hasMocha: boolean
  hasEslint: boolean
  hasPrettier: boolean
  isMonorepo: boolean
  srcDir: string
}

/**
 * Init wizard options
 */
export interface InitOptions {
  /** Working directory */
  cwd: string
  /** Non-interactive mode - accept all defaults */
  yes: boolean
  /** Skip API key prompt */
  skipApiKey: boolean
  /** Verbose output */
  verbose: boolean
}

/**
 * Setup step result
 */
export interface StepResult {
  success: boolean
  message: string
  skipped?: boolean
  error?: string
}

/**
 * Full init result
 */
export interface InitResult {
  success: boolean
  projectInfo: ProjectInfo
  steps: {
    husky: StepResult
    config: StepResult
    env: StepResult
  }
  errors: string[]
}

/**
 * Config generation options based on project type
 */
export interface ConfigDefaults {
  coverageScope: {
    include: string[]
    exclude: string[]
  }
  commands: {
    lint: string | null
    format: string | null
    typecheck: string
    build: string | null
    test: string
    testCoverage: string
    testRelated: string
    testCoverageRelated: string
  }
  rulesFile: string
}
