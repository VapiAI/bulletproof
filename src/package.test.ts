/**
 * Package structure tests
 *
 * These tests verify that the npm package is correctly configured
 * for publishing and that the CLI can be imported properly.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

describe('package.json configuration', () => {
  const packageJson = JSON.parse(
    readFileSync(resolve(projectRoot, 'package.json'), 'utf-8')
  )

  it('should not be marked as private (allows npm publish)', () => {
    // BUG FIX: private: true prevents npm from publishing the package
    // Users were getting ERR_MODULE_NOT_FOUND because the package couldn't be published
    expect(packageJson.private).toBe(false)
  })

  it('should include dist in files array', () => {
    expect(packageJson.files).toContain('dist')
  })

  it('should include bin in files array', () => {
    expect(packageJson.files).toContain('bin')
  })

  it('should have prepublishOnly script that runs build', () => {
    expect(packageJson.scripts.prepublishOnly).toBe('npm run build')
  })

  it('should have bin pointing to correct location', () => {
    expect(packageJson.bin.bulletproof).toBe('./bin/bulletproof.js')
  })
})

describe('bin entry point', () => {
  it('bin/bulletproof.js should exist', () => {
    const binPath = resolve(projectRoot, 'bin/bulletproof.js')
    expect(existsSync(binPath)).toBe(true)
  })

  it('bin/bulletproof.js should import from dist/cli/index.js', () => {
    const binPath = resolve(projectRoot, 'bin/bulletproof.js')
    const content = readFileSync(binPath, 'utf-8')
    expect(content).toContain('../dist/cli/index.js')
  })
})

describe('build output', () => {
  it('dist/cli/index.js should exist after build', () => {
    // This test verifies the fix for: ERR_MODULE_NOT_FOUND: Cannot find module 'dist/cli/index.js'
    const distCliPath = resolve(projectRoot, 'dist/cli/index.js')
    expect(existsSync(distCliPath)).toBe(true)
  })

  it('dist/index.js should exist after build', () => {
    const distIndexPath = resolve(projectRoot, 'dist/index.js')
    expect(existsSync(distIndexPath)).toBe(true)
  })
})
