/**
 * Configuration file generation utilities
 */

import { existsSync, writeFileSync, readFileSync } from 'fs'
import { resolve } from 'path'
import type { BulletproofConfig } from '../../config.js'
import type { ConfigDefaults, ProjectInfo, StepResult } from './types.js'

/**
 * Get smart defaults based on project type
 */
export function getConfigDefaults(info: ProjectInfo): ConfigDefaults {
  const srcDir = info.srcDir

  // Base config with common defaults
  const baseConfig: ConfigDefaults = {
    coverageScope: {
      include: [`${srcDir}/**/*.ts`, `${srcDir}/**/*.tsx`],
      exclude: [
        `${srcDir}/test/**`,
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/types/**',
        '**/*.d.ts',
      ],
    },
    commands: {
      typecheck: 'npm run typecheck',
      test: 'npm run test',
      testCoverage: 'npm run test:coverage',
      testRelated: 'npm run test:related',
      testCoverageRelated: 'npm run test:coverage:related',
    },
    rulesFile: '.cursorrules',
  }

  // Adjust for project type
  switch (info.type) {
    case 'next':
      baseConfig.coverageScope.include = [
        'app/**/*.ts',
        'app/**/*.tsx',
        'components/**/*.ts',
        'components/**/*.tsx',
        'lib/**/*.ts',
        'lib/**/*.tsx',
        `${srcDir}/**/*.ts`,
        `${srcDir}/**/*.tsx`,
      ]
      baseConfig.coverageScope.exclude.push('app/**/layout.tsx', 'app/**/page.tsx')
      break

    case 'nestjs':
      baseConfig.coverageScope.include = [`${srcDir}/**/*.ts`]
      baseConfig.coverageScope.exclude.push(
        '**/*.module.ts',
        '**/*.controller.ts',
        '**/main.ts'
      )
      break

    case 'react':
      baseConfig.coverageScope.include = [
        `${srcDir}/**/*.ts`,
        `${srcDir}/**/*.tsx`,
        'components/**/*.ts',
        'components/**/*.tsx',
      ]
      break

    case 'express':
      baseConfig.coverageScope.include = [
        `${srcDir}/**/*.ts`,
        'routes/**/*.ts',
        'controllers/**/*.ts',
        'services/**/*.ts',
      ]
      break
  }

  // Adjust test command based on test runner
  if (info.hasVitest) {
    baseConfig.commands.test = 'npm run test'
    baseConfig.commands.testCoverage = 'npm run test -- --coverage'
    baseConfig.commands.testRelated = 'npm run test -- --changed'
    baseConfig.commands.testCoverageRelated = 'npm run test -- --coverage --changed'
  } else if (info.hasJest) {
    baseConfig.commands.test = 'npm run test'
    baseConfig.commands.testCoverage = 'npm run test -- --coverage'
    baseConfig.commands.testRelated = 'npm run test -- --findRelatedTests'
    baseConfig.commands.testCoverageRelated = 'npm run test -- --coverage --findRelatedTests'
  }

  // Check for alternate rules files
  if (existsSync(resolve(process.cwd(), '.claude', 'CLAUDE.md'))) {
    baseConfig.rulesFile = '.claude/CLAUDE.md'
  } else if (existsSync(resolve(process.cwd(), '.cursorrules'))) {
    baseConfig.rulesFile = '.cursorrules'
  }

  return baseConfig
}

/**
 * Generate full config from project info
 */
export function generateConfig(info: ProjectInfo): BulletproofConfig {
  const defaults = getConfigDefaults(info)

  return {
    model: 'claude-opus-4-5-20251101',
    maxTurns: 50,
    coverageThresholds: {
      lines: 90,
      statements: 90,
      functions: 78,
      branches: 80,
    },
    coverageScope: defaults.coverageScope,
    checks: {
      rules: true,
      typecheck: info.hasTypeScript,
      tests: info.hasVitest || info.hasJest || info.hasMocha,
      coverage: info.hasVitest || info.hasJest,
    },
    commands: defaults.commands,
    rulesFile: defaults.rulesFile,
  }
}

/**
 * Create config file
 */
export function setupConfig(
  cwd: string,
  info: ProjectInfo,
  options: { force?: boolean; verbose?: boolean } = {}
): StepResult {
  const configPath = resolve(cwd, 'bulletproof.config.json')

  try {
    // Check if config already exists
    if (existsSync(configPath) && !options.force) {
      // Validate existing config
      try {
        const existing = JSON.parse(readFileSync(configPath, 'utf-8'))
        if (existing.model && existing.checks) {
          return {
            success: true,
            message: 'Configuration file already exists',
            skipped: true,
          }
        }
      } catch {
        // Invalid config, overwrite
      }
    }

    // Generate and write config
    const config = generateConfig(info)
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')

    if (options.verbose) {
      console.log('Generated config:', JSON.stringify(config, null, 2))
    }

    return {
      success: true,
      message: 'Created bulletproof.config.json with smart defaults',
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      message: 'Failed to create configuration file',
      error: errorMessage,
    }
  }
}

/**
 * Verify config setup
 */
export function verifyConfigSetup(cwd: string): boolean {
  const configPath = resolve(cwd, 'bulletproof.config.json')
  if (!existsSync(configPath)) {
    return false
  }
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    return !!(config.model && config.checks)
  } catch {
    return false
  }
}
