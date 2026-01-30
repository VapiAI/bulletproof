/**
 * BULLETPROOF - Convention discovery tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import {
  loadFileContent,
  deduplicateContent,
  combineConventions,
  discoverConventionFiles,
  type ConventionFile,
} from './conventions.js'

const TEST_DIR = join(process.cwd(), '.test-conventions')

describe('conventions discovery', () => {
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

  describe('loadFileContent', () => {
    it('should load a valid text file', () => {
      const filePath = join(TEST_DIR, 'test.md')
      writeFileSync(filePath, '# Test Content\n\nHello world!')

      const result = loadFileContent(filePath, 1024)

      expect(result).not.toBeNull()
      expect(result?.content).toBe('# Test Content\n\nHello world!')
      expect(result?.truncated).toBe(false)
    })

    it('should return null for non-existent file', () => {
      const result = loadFileContent(join(TEST_DIR, 'nonexistent.md'), 1024)
      expect(result).toBeNull()
    })

    it('should truncate large files', () => {
      const filePath = join(TEST_DIR, 'large.md')
      const content = 'A'.repeat(1000)
      writeFileSync(filePath, content)

      const result = loadFileContent(filePath, 100)

      expect(result).not.toBeNull()
      expect(result?.truncated).toBe(true)
      expect(result?.content).toContain('... [truncated]')
      expect(result?.size).toBe(1000)
    })

    it('should handle empty files', () => {
      const filePath = join(TEST_DIR, 'empty.md')
      writeFileSync(filePath, '')

      const result = loadFileContent(filePath, 1024)

      expect(result).not.toBeNull()
      expect(result?.content).toBe('')
      expect(result?.size).toBe(0)
    })
  })

  describe('deduplicateContent', () => {
    it('should return single file unchanged', () => {
      const files: ConventionFile[] = [
        { path: '/test/CLAUDE.md', type: 'claude-md', size: 100, content: 'test content' },
      ]

      const result = deduplicateContent(files, ['claude-md', 'cursorrules'])

      expect(result).toHaveLength(1)
      expect(result[0].path).toBe('/test/CLAUDE.md')
    })

    it('should remove duplicate content', () => {
      const files: ConventionFile[] = [
        { path: '/test/CLAUDE.md', type: 'claude-md', size: 100, content: 'same content' },
        { path: '/test/.cursorrules', type: 'cursorrules', size: 100, content: 'same content' },
      ]

      const result = deduplicateContent(files, ['claude-md', 'cursorrules'])

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('claude-md') // Higher priority kept
    })

    it('should keep files with different content', () => {
      const files: ConventionFile[] = [
        { path: '/test/CLAUDE.md', type: 'claude-md', size: 100, content: 'content 1' },
        { path: '/test/.cursorrules', type: 'cursorrules', size: 100, content: 'content 2' },
      ]

      const result = deduplicateContent(files, ['claude-md', 'cursorrules'])

      expect(result).toHaveLength(2)
    })

    it('should normalize whitespace for comparison', () => {
      const files: ConventionFile[] = [
        { path: '/test/CLAUDE.md', type: 'claude-md', size: 100, content: 'content\r\n' },
        { path: '/test/.cursorrules', type: 'cursorrules', size: 100, content: 'content\n' },
      ]

      const result = deduplicateContent(files, ['claude-md', 'cursorrules'])

      expect(result).toHaveLength(1)
    })
  })

  describe('combineConventions', () => {
    it('should return empty string for no files', () => {
      const result = combineConventions([], true)
      expect(result).toBe('')
    })

    it('should return single file content without markers when disabled', () => {
      const files: ConventionFile[] = [
        { path: '/test/CLAUDE.md', type: 'claude-md', size: 100, content: 'test content' },
      ]

      const result = combineConventions(files, false)

      expect(result).toBe('test content')
    })

    it('should add source markers when enabled', () => {
      const files: ConventionFile[] = [
        { path: '/test/CLAUDE.md', type: 'claude-md', size: 100, content: 'content 1' },
        { path: '/test/.cursorrules', type: 'cursorrules', size: 100, content: 'content 2' },
      ]

      const result = combineConventions(files, true)

      expect(result).toContain('# Source: /test/CLAUDE.md')
      expect(result).toContain('# Source: /test/.cursorrules')
      expect(result).toContain('content 1')
      expect(result).toContain('content 2')
      expect(result).toContain('---')
    })
  })

  describe('discoverConventionFiles', () => {
    it('should discover CLAUDE.md', () => {
      writeFileSync(join(TEST_DIR, 'CLAUDE.md'), '# Claude Rules')

      const result = discoverConventionFiles(TEST_DIR)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('claude-md')
      expect(result[0].content).toBe('# Claude Rules')
    })

    it('should discover .cursorrules', () => {
      writeFileSync(join(TEST_DIR, '.cursorrules'), 'cursor rules content')

      const result = discoverConventionFiles(TEST_DIR)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('cursorrules')
    })

    it('should discover .cursor/rules directory', () => {
      mkdirSync(join(TEST_DIR, '.cursor', 'rules'), { recursive: true })
      writeFileSync(join(TEST_DIR, '.cursor', 'rules', 'rule1.md'), 'rule 1')
      writeFileSync(join(TEST_DIR, '.cursor', 'rules', 'rule2.md'), 'rule 2')

      const result = discoverConventionFiles(TEST_DIR)

      expect(result).toHaveLength(2)
      expect(result.every((f) => f.type === 'cursor-rules-dir')).toBe(true)
    })

    it('should discover .claude/settings.json', () => {
      mkdirSync(join(TEST_DIR, '.claude'), { recursive: true })
      writeFileSync(
        join(TEST_DIR, '.claude', 'settings.json'),
        JSON.stringify({ rules: 'test' })
      )

      const result = discoverConventionFiles(TEST_DIR)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('claude-settings')
    })

    it('should respect priority order', () => {
      writeFileSync(join(TEST_DIR, 'CLAUDE.md'), 'claude content')
      writeFileSync(join(TEST_DIR, '.cursorrules'), 'cursor content')

      const result = discoverConventionFiles(TEST_DIR)

      expect(result).toHaveLength(2)
      // First should be claude-md (higher priority)
      expect(result[0].type).toBe('claude-md')
    })

    it('should respect combined size limit', () => {
      // Create two 60KB files (combined would exceed 100KB limit)
      const content = 'A'.repeat(60 * 1024)
      writeFileSync(join(TEST_DIR, 'CLAUDE.md'), content)
      writeFileSync(join(TEST_DIR, '.cursorrules'), content)

      const result = discoverConventionFiles(TEST_DIR, {
        maxCombinedSize: 100 * 1024,
      })

      // Should only include files up to the limit
      expect(result.length).toBeLessThanOrEqual(2)
      const totalSize = result.reduce((sum, f) => sum + f.size, 0)
      expect(totalSize).toBeLessThanOrEqual(100 * 1024)
    })

    it('should return empty array for directory with no conventions', () => {
      const result = discoverConventionFiles(TEST_DIR)
      expect(result).toHaveLength(0)
    })
  })
})
