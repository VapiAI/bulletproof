/**
 * Environment and API key setup utilities
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'fs'
import { resolve } from 'path'
import type { StepResult } from './types.js'

/**
 * Check if .gitignore has the env file
 */
function ensureGitignore(cwd: string, envFile: string): void {
  const gitignorePath = resolve(cwd, '.gitignore')

  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, `${envFile}\n`)
    return
  }

  const content = readFileSync(gitignorePath, 'utf-8')
  if (!content.includes(envFile)) {
    appendFileSync(gitignorePath, `\n${envFile}\n`)
  }
}

/**
 * Add API key to environment file
 */
export function addApiKeyToEnv(
  cwd: string,
  apiKey: string,
  options: { verbose?: boolean } = {}
): StepResult {
  const envFile = '.env.local'
  const envPath = resolve(cwd, envFile)

  try {
    // Check if key already exists in any env file
    const envFiles = ['.env', '.env.local', '.env.development']
    for (const file of envFiles) {
      const filePath = resolve(cwd, file)
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf-8')
        if (content.includes('ANTHROPIC_API_KEY=')) {
          // Check if it has a value
          const match = content.match(/ANTHROPIC_API_KEY=(.*)/)
          if (match && match[1].trim()) {
            return {
              success: true,
              message: `ANTHROPIC_API_KEY already set in ${file}`,
              skipped: true,
            }
          }
        }
      }
    }

    // Validate API key format (basic validation)
    if (!apiKey.startsWith('sk-ant-')) {
      return {
        success: false,
        message: 'Invalid API key format',
        error: 'API key should start with sk-ant-',
      }
    }

    // Add to .env.local
    const envContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : ''
    const newLine = envContent.endsWith('\n') || envContent === '' ? '' : '\n'
    appendFileSync(envPath, `${newLine}ANTHROPIC_API_KEY=${apiKey}\n`)

    // Ensure .env.local is in .gitignore
    ensureGitignore(cwd, envFile)

    if (options.verbose) {
      console.log(`Added ANTHROPIC_API_KEY to ${envFile}`)
    }

    return {
      success: true,
      message: `Added ANTHROPIC_API_KEY to ${envFile}`,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      message: 'Failed to add API key to environment',
      error: errorMessage,
    }
  }
}

/**
 * Check if API key is configured
 */
export function checkApiKeyConfigured(cwd: string): {
  configured: boolean
  source: string | null
} {
  // Check environment variable first
  if (process.env.ANTHROPIC_API_KEY) {
    return { configured: true, source: 'environment variable' }
  }

  // Check env files
  const envFiles = ['.env', '.env.local', '.env.development']
  for (const file of envFiles) {
    const filePath = resolve(cwd, file)
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8')
        const match = content.match(/ANTHROPIC_API_KEY=(.+)/)
        if (match && match[1].trim()) {
          return { configured: true, source: file }
        }
      } catch {
        // Continue checking
      }
    }
  }

  return { configured: false, source: null }
}

/**
 * Skip API key setup (for CI or when already configured)
 */
export function skipApiKeySetup(): StepResult {
  return {
    success: true,
    message: 'API key setup skipped',
    skipped: true,
  }
}
