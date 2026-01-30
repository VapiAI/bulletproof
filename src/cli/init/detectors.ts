/**
 * Project and package manager detection utilities
 */

import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import type { PackageManager, ProjectInfo, ProjectType } from './types.js'

/**
 * Package.json structure (partial)
 */
interface PackageJson {
  name?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  workspaces?: string[] | { packages: string[] }
}

/**
 * Read and parse package.json
 */
export function readPackageJson(cwd: string): PackageJson | null {
  const pkgPath = resolve(cwd, 'package.json')
  if (!existsSync(pkgPath)) {
    return null
  }
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf-8')) as PackageJson
  } catch {
    return null
  }
}

/**
 * Detect package manager from lock files
 */
export function detectPackageManager(cwd: string): PackageManager {
  // Check in order of specificity
  if (existsSync(resolve(cwd, 'bun.lockb'))) {
    return 'bun'
  }
  if (existsSync(resolve(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }
  if (existsSync(resolve(cwd, 'yarn.lock'))) {
    return 'yarn'
  }
  // Default to npm
  return 'npm'
}

/**
 * Check if a dependency exists in package.json
 */
function hasDependency(pkg: PackageJson, name: string): boolean {
  return !!(pkg.dependencies?.[name] || pkg.devDependencies?.[name])
}

/**
 * Detect project type from dependencies
 */
export function detectProjectType(pkg: PackageJson): ProjectType {
  // Check in order of specificity
  if (hasDependency(pkg, 'next')) {
    return 'next'
  }
  if (hasDependency(pkg, '@nestjs/core')) {
    return 'nestjs'
  }
  if (hasDependency(pkg, 'express')) {
    return 'express'
  }
  if (hasDependency(pkg, 'react') || hasDependency(pkg, 'react-dom')) {
    return 'react'
  }
  // Check if it's a Node.js project
  if (pkg.name || pkg.dependencies || pkg.devDependencies) {
    return 'node'
  }
  return 'unknown'
}

/**
 * Detect source directory
 */
export function detectSrcDir(cwd: string): string {
  // Common source directories
  const candidates = ['src', 'lib', 'app', 'source']
  for (const dir of candidates) {
    if (existsSync(resolve(cwd, dir))) {
      return dir
    }
  }
  return 'src' // Default
}

/**
 * Check if project is a monorepo
 */
export function detectMonorepo(cwd: string, pkg: PackageJson): boolean {
  // Check for workspace configuration
  if (pkg.workspaces) {
    return true
  }
  // Check for common monorepo config files
  const monorepoFiles = ['lerna.json', 'pnpm-workspace.yaml', 'rush.json', 'nx.json', 'turbo.json']
  return monorepoFiles.some((file) => existsSync(resolve(cwd, file)))
}

/**
 * Detect all project information
 */
export function detectProjectInfo(cwd: string): ProjectInfo {
  const pkg = readPackageJson(cwd)

  if (!pkg) {
    return {
      type: 'unknown',
      packageManager: detectPackageManager(cwd),
      hasTypeScript: existsSync(resolve(cwd, 'tsconfig.json')),
      hasVitest: false,
      hasJest: false,
      hasMocha: false,
      hasEslint: existsSync(resolve(cwd, '.eslintrc.json')) || existsSync(resolve(cwd, 'eslint.config.js')),
      hasPrettier: existsSync(resolve(cwd, '.prettierrc')) || existsSync(resolve(cwd, 'prettier.config.js')),
      isMonorepo: false,
      srcDir: detectSrcDir(cwd),
    }
  }

  return {
    type: detectProjectType(pkg),
    packageManager: detectPackageManager(cwd),
    hasTypeScript: hasDependency(pkg, 'typescript') || existsSync(resolve(cwd, 'tsconfig.json')),
    hasVitest: hasDependency(pkg, 'vitest'),
    hasJest: hasDependency(pkg, 'jest'),
    hasMocha: hasDependency(pkg, 'mocha'),
    hasEslint: hasDependency(pkg, 'eslint') || existsSync(resolve(cwd, '.eslintrc.json')),
    hasPrettier: hasDependency(pkg, 'prettier') || existsSync(resolve(cwd, '.prettierrc')),
    isMonorepo: detectMonorepo(cwd, pkg),
    srcDir: detectSrcDir(cwd),
  }
}

/**
 * Check if git is initialized
 */
export function isGitRepo(cwd: string): boolean {
  return existsSync(resolve(cwd, '.git'))
}

/**
 * Check if husky is already set up
 */
export function isHuskySetup(cwd: string): boolean {
  return existsSync(resolve(cwd, '.husky'))
}

/**
 * Check if bulletproof config exists
 */
export function hasExistingConfig(cwd: string): boolean {
  const configFiles = [
    'bulletproof.config.json',
    'bulletproof.config.js',
    '.bulletproofrc',
    '.bulletproofrc.json',
  ]
  return configFiles.some((file) => existsSync(resolve(cwd, file)))
}

/**
 * Check if ANTHROPIC_API_KEY exists in environment or .env files
 */
export function hasApiKey(cwd: string): boolean {
  // Check environment variable
  if (process.env.ANTHROPIC_API_KEY) {
    return true
  }

  // Check common env files
  const envFiles = ['.env', '.env.local', '.env.development']
  for (const file of envFiles) {
    const envPath = resolve(cwd, file)
    if (existsSync(envPath)) {
      try {
        const content = readFileSync(envPath, 'utf-8')
        if (content.includes('ANTHROPIC_API_KEY=')) {
          return true
        }
      } catch {
        // Continue checking other files
      }
    }
  }

  return false
}

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.JENKINS_URL ||
    process.env.BUILDKITE ||
    process.env.TRAVIS
  )
}
