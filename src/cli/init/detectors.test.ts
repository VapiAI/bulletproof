/**
 * Tests for project and package manager detection utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { PathLike } from 'fs'
import { existsSync, readFileSync } from 'fs'
import {
  detectPackageManager,
  detectProjectType,
  detectProjectInfo,
  detectSrcDir,
  detectMonorepo,
  isGitRepo,
  isHuskySetup,
  hasExistingConfig,
  hasApiKey,
  isCI,
} from './detectors.js'

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}))

describe('detectPackageManager', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should detect bun from bun.lockb', () => {
    vi.mocked(existsSync).mockImplementation((path: PathLike) => {
      return path.toString().endsWith('bun.lockb')
    })
    expect(detectPackageManager('/test')).toBe('bun')
  })

  it('should detect pnpm from pnpm-lock.yaml', () => {
    vi.mocked(existsSync).mockImplementation((path: PathLike) => {
      return path.toString().endsWith('pnpm-lock.yaml')
    })
    expect(detectPackageManager('/test')).toBe('pnpm')
  })

  it('should detect yarn from yarn.lock', () => {
    vi.mocked(existsSync).mockImplementation((path: PathLike) => {
      return path.toString().endsWith('yarn.lock')
    })
    expect(detectPackageManager('/test')).toBe('yarn')
  })

  it('should default to npm when no lock file found', () => {
    vi.mocked(existsSync).mockReturnValue(false)
    expect(detectPackageManager('/test')).toBe('npm')
  })
})

describe('detectProjectType', () => {
  it('should detect Next.js project', () => {
    const pkg = { dependencies: { next: '^14.0.0' } }
    expect(detectProjectType(pkg)).toBe('next')
  })

  it('should detect NestJS project', () => {
    const pkg = { dependencies: { '@nestjs/core': '^10.0.0' } }
    expect(detectProjectType(pkg)).toBe('nestjs')
  })

  it('should detect Express project', () => {
    const pkg = { dependencies: { express: '^4.18.0' } }
    expect(detectProjectType(pkg)).toBe('express')
  })

  it('should detect React project', () => {
    const pkg = { dependencies: { react: '^18.0.0' } }
    expect(detectProjectType(pkg)).toBe('react')
  })

  it('should detect Node.js project when has package.json', () => {
    const pkg = { name: 'my-project', dependencies: {} }
    expect(detectProjectType(pkg)).toBe('node')
  })

  it('should return unknown for empty package', () => {
    const pkg = {}
    expect(detectProjectType(pkg)).toBe('unknown')
  })

  it('should prefer Next.js over React when both present', () => {
    const pkg = { dependencies: { next: '^14.0.0', react: '^18.0.0' } }
    expect(detectProjectType(pkg)).toBe('next')
  })

  it('should detect from devDependencies', () => {
    const pkg = { devDependencies: { next: '^14.0.0' } }
    expect(detectProjectType(pkg)).toBe('next')
  })
})

describe('detectSrcDir', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should detect src directory', () => {
    vi.mocked(existsSync).mockImplementation((path: PathLike) => {
      return path.toString().endsWith('/src')
    })
    expect(detectSrcDir('/test')).toBe('src')
  })

  it('should detect lib directory', () => {
    vi.mocked(existsSync).mockImplementation((path: PathLike) => {
      return path.toString().endsWith('/lib')
    })
    expect(detectSrcDir('/test')).toBe('lib')
  })

  it('should detect app directory', () => {
    vi.mocked(existsSync).mockImplementation((path: PathLike) => {
      return path.toString().endsWith('/app')
    })
    expect(detectSrcDir('/test')).toBe('app')
  })

  it('should default to src when no directory found', () => {
    vi.mocked(existsSync).mockReturnValue(false)
    expect(detectSrcDir('/test')).toBe('src')
  })
})

describe('detectMonorepo', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should detect monorepo from workspaces in package.json', () => {
    const pkg = { workspaces: ['packages/*'] }
    expect(detectMonorepo('/test', pkg)).toBe(true)
  })

  it('should detect monorepo from workspaces object', () => {
    const pkg = { workspaces: { packages: ['packages/*'] } }
    expect(detectMonorepo('/test', pkg)).toBe(true)
  })

  it('should detect monorepo from lerna.json', () => {
    vi.mocked(existsSync).mockImplementation((path: PathLike) => {
      return path.toString().endsWith('lerna.json')
    })
    expect(detectMonorepo('/test', {})).toBe(true)
  })

  it('should detect monorepo from pnpm-workspace.yaml', () => {
    vi.mocked(existsSync).mockImplementation((path: PathLike) => {
      return path.toString().endsWith('pnpm-workspace.yaml')
    })
    expect(detectMonorepo('/test', {})).toBe(true)
  })

  it('should detect monorepo from turbo.json', () => {
    vi.mocked(existsSync).mockImplementation((path: PathLike) => {
      return path.toString().endsWith('turbo.json')
    })
    expect(detectMonorepo('/test', {})).toBe(true)
  })

  it('should return false when not a monorepo', () => {
    vi.mocked(existsSync).mockReturnValue(false)
    expect(detectMonorepo('/test', {})).toBe(false)
  })
})

describe('isGitRepo', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should return true when .git exists', () => {
    vi.mocked(existsSync).mockImplementation((path: PathLike) => {
      return path.toString().endsWith('.git')
    })
    expect(isGitRepo('/test')).toBe(true)
  })

  it('should return false when .git does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false)
    expect(isGitRepo('/test')).toBe(false)
  })
})

describe('isHuskySetup', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should return true when .husky exists', () => {
    vi.mocked(existsSync).mockImplementation((path: PathLike) => {
      return path.toString().endsWith('.husky')
    })
    expect(isHuskySetup('/test')).toBe(true)
  })

  it('should return false when .husky does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false)
    expect(isHuskySetup('/test')).toBe(false)
  })
})

describe('hasExistingConfig', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should return true when bulletproof.config.json exists', () => {
    vi.mocked(existsSync).mockImplementation((path: PathLike) => {
      return path.toString().endsWith('bulletproof.config.json')
    })
    expect(hasExistingConfig('/test')).toBe(true)
  })

  it('should return true when .bulletproofrc exists', () => {
    vi.mocked(existsSync).mockImplementation((path: PathLike) => {
      return path.toString().endsWith('.bulletproofrc')
    })
    expect(hasExistingConfig('/test')).toBe(true)
  })

  it('should return false when no config exists', () => {
    vi.mocked(existsSync).mockReturnValue(false)
    expect(hasExistingConfig('/test')).toBe(false)
  })
})

describe('hasApiKey', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should return true when ANTHROPIC_API_KEY is in environment', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test'
    expect(hasApiKey('/test')).toBe(true)
  })

  it('should return true when API key is in .env file', () => {
    delete process.env.ANTHROPIC_API_KEY
    vi.mocked(existsSync).mockImplementation((path: PathLike) => {
      return path.toString().endsWith('.env')
    })
    vi.mocked(readFileSync).mockReturnValue('ANTHROPIC_API_KEY=sk-ant-test')
    expect(hasApiKey('/test')).toBe(true)
  })

  it('should return true when API key is in .env.local file', () => {
    delete process.env.ANTHROPIC_API_KEY
    vi.mocked(existsSync).mockImplementation((path: PathLike) => {
      return path.toString().endsWith('.env.local')
    })
    vi.mocked(readFileSync).mockReturnValue('ANTHROPIC_API_KEY=sk-ant-test')
    expect(hasApiKey('/test')).toBe(true)
  })

  it('should return false when no API key found', () => {
    delete process.env.ANTHROPIC_API_KEY
    vi.mocked(existsSync).mockReturnValue(false)
    expect(hasApiKey('/test')).toBe(false)
  })
})

describe('isCI', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.CI
    delete process.env.CONTINUOUS_INTEGRATION
    delete process.env.GITHUB_ACTIONS
    delete process.env.GITLAB_CI
    delete process.env.CIRCLECI
    delete process.env.JENKINS_URL
    delete process.env.BUILDKITE
    delete process.env.TRAVIS
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should return true when CI is set', () => {
    process.env.CI = 'true'
    expect(isCI()).toBe(true)
  })

  it('should return true when GITHUB_ACTIONS is set', () => {
    process.env.GITHUB_ACTIONS = 'true'
    expect(isCI()).toBe(true)
  })

  it('should return true when GITLAB_CI is set', () => {
    process.env.GITLAB_CI = 'true'
    expect(isCI()).toBe(true)
  })

  it('should return false when no CI env is set', () => {
    expect(isCI()).toBe(false)
  })
})

describe('detectProjectInfo', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should return full project info for a Next.js project', () => {
    const mockPkg = JSON.stringify({
      name: 'my-next-app',
      dependencies: {
        next: '^14.0.0',
        react: '^18.0.0',
      },
      devDependencies: {
        typescript: '^5.0.0',
        vitest: '^1.0.0',
        eslint: '^8.0.0',
      },
    })

    vi.mocked(existsSync).mockImplementation((path: PathLike) => {
      const pathStr = path.toString()
      if (pathStr.endsWith('package.json')) return true
      if (pathStr.endsWith('.git')) return true
      if (pathStr.endsWith('tsconfig.json')) return true
      if (pathStr.endsWith('/src')) return true
      return false
    })
    vi.mocked(readFileSync).mockReturnValue(mockPkg)

    const info = detectProjectInfo('/test')

    expect(info.type).toBe('next')
    expect(info.hasTypeScript).toBe(true)
    expect(info.hasVitest).toBe(true)
    expect(info.hasEslint).toBe(true)
    expect(info.srcDir).toBe('src')
  })

  it('should handle missing package.json', () => {
    vi.mocked(existsSync).mockImplementation((path: PathLike) => {
      const pathStr = path.toString()
      if (pathStr.endsWith('.git')) return true
      if (pathStr.endsWith('tsconfig.json')) return true
      return false
    })

    const info = detectProjectInfo('/test')

    expect(info.type).toBe('unknown')
    expect(info.hasTypeScript).toBe(true)
    expect(info.packageManager).toBe('npm')
  })
})
