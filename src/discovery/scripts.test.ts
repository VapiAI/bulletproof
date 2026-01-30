/**
 * BULLETPROOF - Script discovery tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import {
  isBlacklisted,
  categorizeScript,
  detectPackageManager,
  discoverScripts,
  getOrderedChecks,
  hasCheck,
  getCheckCommand,
  CHECK_EXECUTION_ORDER,
} from './scripts.js'

const TEST_DIR = join(process.cwd(), '.test-scripts')

describe('scripts discovery', () => {
  beforeEach(() => {
    // Create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true })
    }
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    // Cleanup test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true })
    }
  })

  describe('isBlacklisted', () => {
    it('should blacklist watch scripts', () => {
      expect(isBlacklisted('watch')).toBe(true)
      expect(isBlacklisted('lint:watch')).toBe(true)
      expect(isBlacklisted('build:watch')).toBe(true)
    })

    it('should blacklist dev scripts', () => {
      expect(isBlacklisted('dev')).toBe(true)
      expect(isBlacklisted('start:dev')).toBe(true)
    })

    it('should blacklist fix scripts', () => {
      expect(isBlacklisted('lint:fix')).toBe(true)
      expect(isBlacklisted('format:fix')).toBe(true)
    })

    it('should blacklist CI scripts', () => {
      expect(isBlacklisted('test:ci')).toBe(true)
      expect(isBlacklisted('lint:ci')).toBe(true)
    })

    it('should blacklist specific dangerous scripts', () => {
      expect(isBlacklisted('lint-staged')).toBe(true)
      expect(isBlacklisted('husky')).toBe(true)
      expect(isBlacklisted('prepare')).toBe(true)
    })

    it('should not blacklist regular scripts', () => {
      expect(isBlacklisted('lint')).toBe(false)
      expect(isBlacklisted('build')).toBe(false)
      expect(isBlacklisted('typecheck')).toBe(false)
      expect(isBlacklisted('format')).toBe(false)
    })
  })

  describe('categorizeScript', () => {
    it('should categorize lint scripts', () => {
      expect(categorizeScript('lint')).toBe('lint')
      expect(categorizeScript('eslint')).toBe('lint')
      expect(categorizeScript('lint:src')).toBe('lint')
    })

    it('should categorize typecheck scripts', () => {
      expect(categorizeScript('typecheck')).toBe('typecheck')
      expect(categorizeScript('type-check')).toBe('typecheck')
      expect(categorizeScript('tsc')).toBe('typecheck')
      expect(categorizeScript('types')).toBe('typecheck')
    })

    it('should categorize build scripts', () => {
      expect(categorizeScript('build')).toBe('build')
      expect(categorizeScript('compile')).toBe('build')
      expect(categorizeScript('build:prod')).toBe('build')
    })

    it('should categorize format scripts', () => {
      expect(categorizeScript('format')).toBe('format')
      expect(categorizeScript('prettier')).toBe('format')
      expect(categorizeScript('fmt')).toBe('format')
    })

    it('should return null for blacklisted scripts', () => {
      expect(categorizeScript('lint:fix')).toBeNull()
      expect(categorizeScript('build:watch')).toBeNull()
    })

    it('should return null for unknown scripts', () => {
      expect(categorizeScript('start')).toBeNull()
      expect(categorizeScript('deploy')).toBeNull()
      expect(categorizeScript('test')).toBeNull() // tests are excluded
    })
  })

  describe('detectPackageManager', () => {
    it('should detect npm (default)', () => {
      expect(detectPackageManager(TEST_DIR)).toBe('npm')
    })

    it('should detect yarn', () => {
      writeFileSync(join(TEST_DIR, 'yarn.lock'), '')
      expect(detectPackageManager(TEST_DIR)).toBe('yarn')
    })

    it('should detect pnpm', () => {
      writeFileSync(join(TEST_DIR, 'pnpm-lock.yaml'), '')
      expect(detectPackageManager(TEST_DIR)).toBe('pnpm')
    })

    it('should detect bun', () => {
      writeFileSync(join(TEST_DIR, 'bun.lockb'), '')
      expect(detectPackageManager(TEST_DIR)).toBe('bun')
    })

    it('should prefer bun over others', () => {
      writeFileSync(join(TEST_DIR, 'bun.lockb'), '')
      writeFileSync(join(TEST_DIR, 'yarn.lock'), '')
      expect(detectPackageManager(TEST_DIR)).toBe('bun')
    })
  })

  describe('discoverScripts', () => {
    it('should discover lint script', () => {
      writeFileSync(
        join(TEST_DIR, 'package.json'),
        JSON.stringify({
          scripts: {
            lint: 'eslint src/',
          },
        })
      )

      const result = discoverScripts(TEST_DIR)

      expect(result.scripts.lint).not.toBeNull()
      expect(result.scripts.lint?.name).toBe('lint')
      expect(result.scripts.lint?.runCommand).toBe('npm run lint')
    })

    it('should discover multiple scripts', () => {
      writeFileSync(
        join(TEST_DIR, 'package.json'),
        JSON.stringify({
          scripts: {
            lint: 'eslint src/',
            typecheck: 'tsc --noEmit',
            build: 'tsc',
            format: 'prettier --check .',
          },
        })
      )

      const result = discoverScripts(TEST_DIR)

      expect(result.scripts.lint).not.toBeNull()
      expect(result.scripts.typecheck).not.toBeNull()
      expect(result.scripts.build).not.toBeNull()
      expect(result.scripts.format).not.toBeNull()
    })

    it('should prefer exact matches over prefix matches', () => {
      writeFileSync(
        join(TEST_DIR, 'package.json'),
        JSON.stringify({
          scripts: {
            'lint:src': 'eslint src/',
            lint: 'eslint .',
          },
        })
      )

      const result = discoverScripts(TEST_DIR)

      expect(result.scripts.lint?.name).toBe('lint')
    })

    it('should skip blacklisted scripts', () => {
      writeFileSync(
        join(TEST_DIR, 'package.json'),
        JSON.stringify({
          scripts: {
            'lint:fix': 'eslint --fix .',
            'lint:watch': 'eslint --watch .',
            lint: 'eslint .',
          },
        })
      )

      const result = discoverScripts(TEST_DIR)

      expect(result.scripts.lint?.name).toBe('lint')
      expect(result.allScripts).toHaveLength(1)
    })

    it('should handle missing package.json', () => {
      const result = discoverScripts(TEST_DIR)

      expect(result.scripts.lint).toBeNull()
      expect(result.scripts.typecheck).toBeNull()
      expect(result.allScripts).toHaveLength(0)
    })

    it('should handle invalid package.json', () => {
      writeFileSync(join(TEST_DIR, 'package.json'), 'invalid json')

      const result = discoverScripts(TEST_DIR)

      expect(result.scripts.lint).toBeNull()
    })

    it('should use correct package manager run command', () => {
      writeFileSync(join(TEST_DIR, 'yarn.lock'), '')
      writeFileSync(
        join(TEST_DIR, 'package.json'),
        JSON.stringify({
          scripts: {
            lint: 'eslint .',
          },
        })
      )

      const result = discoverScripts(TEST_DIR)

      expect(result.packageManager).toBe('yarn')
      expect(result.scripts.lint?.runCommand).toBe('yarn lint')
    })
  })

  describe('getOrderedChecks', () => {
    it('should return checks in execution order', () => {
      writeFileSync(
        join(TEST_DIR, 'package.json'),
        JSON.stringify({
          scripts: {
            build: 'tsc',
            lint: 'eslint .',
            format: 'prettier --check .',
            typecheck: 'tsc --noEmit',
          },
        })
      )

      const discovery = discoverScripts(TEST_DIR)
      const ordered = getOrderedChecks(discovery)

      // Order should be: lint, format, typecheck, build
      expect(ordered.map((s) => s.category)).toEqual([
        'lint',
        'format',
        'typecheck',
        'build',
      ])
    })

    it('should skip missing checks', () => {
      writeFileSync(
        join(TEST_DIR, 'package.json'),
        JSON.stringify({
          scripts: {
            lint: 'eslint .',
            build: 'tsc',
          },
        })
      )

      const discovery = discoverScripts(TEST_DIR)
      const ordered = getOrderedChecks(discovery)

      expect(ordered).toHaveLength(2)
      expect(ordered.map((s) => s.category)).toEqual(['lint', 'build'])
    })
  })

  describe('hasCheck', () => {
    it('should return true for available checks', () => {
      writeFileSync(
        join(TEST_DIR, 'package.json'),
        JSON.stringify({
          scripts: {
            lint: 'eslint .',
          },
        })
      )

      const discovery = discoverScripts(TEST_DIR)

      expect(hasCheck(discovery, 'lint')).toBe(true)
      expect(hasCheck(discovery, 'build')).toBe(false)
    })
  })

  describe('getCheckCommand', () => {
    it('should return command for available check', () => {
      writeFileSync(
        join(TEST_DIR, 'package.json'),
        JSON.stringify({
          scripts: {
            lint: 'eslint .',
          },
        })
      )

      const discovery = discoverScripts(TEST_DIR)

      expect(getCheckCommand(discovery, 'lint')).toBe('npm run lint')
    })

    it('should return null for missing check', () => {
      writeFileSync(
        join(TEST_DIR, 'package.json'),
        JSON.stringify({
          scripts: {},
        })
      )

      const discovery = discoverScripts(TEST_DIR)

      expect(getCheckCommand(discovery, 'lint')).toBeNull()
    })
  })

  describe('CHECK_EXECUTION_ORDER', () => {
    it('should have correct order', () => {
      expect(CHECK_EXECUTION_ORDER).toEqual([
        'lint',
        'format',
        'typecheck',
        'build',
      ])
    })
  })
})
