/**
 * BULLETPROOF Init Wizard
 *
 * Fully automated setup for bulletproof in any project.
 */

import prompts from 'prompts'
import {
  detectProjectInfo,
  isGitRepo,
  hasExistingConfig,
  isCI,
} from './detectors.js'
import { setupHusky, verifyHuskySetup } from './setup-husky.js'
import { setupConfig, verifyConfigSetup } from './setup-config.js'
import { addApiKeyToEnv, checkApiKeyConfigured, skipApiKeySetup } from './setup-env.js'
import type { InitOptions, InitResult, StepResult } from './types.js'

/**
 * Format project type for display
 */
function formatProjectType(type: string): string {
  const names: Record<string, string> = {
    next: 'Next.js',
    nestjs: 'NestJS',
    react: 'React',
    express: 'Express',
    node: 'Node.js',
    unknown: 'Unknown',
  }
  return names[type] || type
}

/**
 * Print colored output
 */
function print(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info'): void {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    warning: '\x1b[33m', // Yellow
    error: '\x1b[31m',   // Red
  }
  const reset = '\x1b[0m'
  console.log(`${colors[type]}${message}${reset}`)
}

/**
 * Print step result
 */
function printStepResult(name: string, result: StepResult): void {
  if (result.success) {
    if (result.skipped) {
      print(`  [SKIP] ${name}: ${result.message}`, 'warning')
    } else {
      print(`  [OK] ${name}: ${result.message}`, 'success')
    }
  } else {
    print(`  [FAIL] ${name}: ${result.message}`, 'error')
    if (result.error) {
      print(`         ${result.error}`, 'error')
    }
  }
}

/**
 * Run the init wizard
 */
export async function runInitWizard(options: Partial<InitOptions> = {}): Promise<InitResult> {
  const cwd = options.cwd ?? process.cwd()
  const isNonInteractive = options.yes || isCI()
  const verbose = options.verbose ?? false

  const errors: string[] = []

  // Banner
  console.log('')
  print('BULLETPROOF Setup Wizard', 'info')
  print('========================', 'info')
  console.log('')

  // Check git repo
  if (!isGitRepo(cwd)) {
    print('Error: Not a git repository. Please run `git init` first.', 'error')
    return {
      success: false,
      projectInfo: {
        type: 'unknown',
        packageManager: 'npm',
        hasTypeScript: false,
        hasVitest: false,
        hasJest: false,
        hasMocha: false,
        hasEslint: false,
        hasPrettier: false,
        isMonorepo: false,
        srcDir: 'src',
      },
      steps: {
        husky: { success: false, message: 'Skipped - not a git repo' },
        config: { success: false, message: 'Skipped - not a git repo' },
        env: { success: false, message: 'Skipped - not a git repo' },
      },
      errors: ['Not a git repository'],
    }
  }

  // Detect project info
  print('Detecting project configuration...', 'info')
  const projectInfo = detectProjectInfo(cwd)

  console.log('')
  print(`  Project type: ${formatProjectType(projectInfo.type)}`, 'info')
  print(`  Package manager: ${projectInfo.packageManager}`, 'info')
  print(`  TypeScript: ${projectInfo.hasTypeScript ? 'Yes' : 'No'}`, 'info')
  print(`  Test runner: ${projectInfo.hasVitest ? 'Vitest' : projectInfo.hasJest ? 'Jest' : projectInfo.hasMocha ? 'Mocha' : 'None detected'}`, 'info')
  print(`  Source directory: ${projectInfo.srcDir}`, 'info')
  console.log('')

  // Check for existing setup
  const existingConfig = hasExistingConfig(cwd)
  const existingHusky = verifyHuskySetup(cwd)

  if (existingConfig && existingHusky) {
    print('BULLETPROOF is already configured in this project.', 'success')
    console.log('')

    if (!isNonInteractive) {
      const { reconfigure } = await prompts({
        type: 'confirm',
        name: 'reconfigure',
        message: 'Would you like to reconfigure?',
        initial: false,
      })

      if (!reconfigure) {
        return {
          success: true,
          projectInfo,
          steps: {
            husky: { success: true, message: 'Already configured', skipped: true },
            config: { success: true, message: 'Already configured', skipped: true },
            env: { success: true, message: 'Already configured', skipped: true },
          },
          errors: [],
        }
      }
    }
  }

  // Confirm setup in interactive mode
  if (!isNonInteractive) {
    const { proceed } = await prompts({
      type: 'confirm',
      name: 'proceed',
      message: 'Proceed with setup?',
      initial: true,
    })

    if (!proceed) {
      print('Setup cancelled.', 'warning')
      return {
        success: false,
        projectInfo,
        steps: {
          husky: { success: false, message: 'Cancelled' },
          config: { success: false, message: 'Cancelled' },
          env: { success: false, message: 'Cancelled' },
        },
        errors: ['Setup cancelled by user'],
      }
    }
  }

  console.log('')
  print('Setting up BULLETPROOF...', 'info')
  console.log('')

  // Step 1: Setup Husky
  print('Step 1: Setting up Husky pre-push hook...', 'info')
  const huskyResult = await setupHusky(cwd, projectInfo.packageManager, { verbose })
  printStepResult('Husky', huskyResult)
  if (!huskyResult.success) {
    errors.push(`Husky setup failed: ${huskyResult.error}`)
  }

  // Step 2: Create config
  print('Step 2: Creating configuration file...', 'info')
  const configResult = setupConfig(cwd, projectInfo, { verbose })
  printStepResult('Config', configResult)
  if (!configResult.success) {
    errors.push(`Config setup failed: ${configResult.error}`)
  }

  // Step 3: API key
  print('Step 3: Checking API key...', 'info')
  let envResult: StepResult

  const apiKeyStatus = checkApiKeyConfigured(cwd)
  if (apiKeyStatus.configured) {
    envResult = {
      success: true,
      message: `API key found in ${apiKeyStatus.source}`,
      skipped: true,
    }
  } else if (options.skipApiKey || isNonInteractive) {
    envResult = skipApiKeySetup()
    if (!isNonInteractive) {
      print('  Note: Set ANTHROPIC_API_KEY environment variable before running bulletproof', 'warning')
    }
  } else {
    // Interactive API key prompt
    const { apiKey } = await prompts({
      type: 'password',
      name: 'apiKey',
      message: 'Enter your Anthropic API key (or press Enter to skip):',
    })

    if (apiKey && apiKey.trim()) {
      envResult = addApiKeyToEnv(cwd, apiKey.trim(), { verbose })
    } else {
      envResult = skipApiKeySetup()
      print('  Note: Set ANTHROPIC_API_KEY environment variable before running bulletproof', 'warning')
    }
  }
  printStepResult('API Key', envResult)
  if (!envResult.success && !envResult.skipped) {
    errors.push(`API key setup failed: ${envResult.error}`)
  }

  // Verify setup
  console.log('')
  print('Verifying setup...', 'info')

  const huskyVerified = verifyHuskySetup(cwd)
  const configVerified = verifyConfigSetup(cwd)

  if (huskyVerified && configVerified) {
    print('  All checks passed!', 'success')
  } else {
    if (!huskyVerified) {
      print('  Warning: Husky setup could not be verified', 'warning')
    }
    if (!configVerified) {
      print('  Warning: Config setup could not be verified', 'warning')
    }
  }

  // Summary
  console.log('')
  const overallSuccess = huskyResult.success && configResult.success

  if (overallSuccess) {
    print('BULLETPROOF setup complete!', 'success')
    console.log('')
    print('What happens now:', 'info')
    print('  - When you push code, bulletproof will automatically run checks', 'info')
    print('  - If issues are found, Claude will attempt to fix them', 'info')
    print('  - Fixed code will be committed and pushed automatically', 'info')
    console.log('')
    print('Next steps:', 'info')
    print('  1. Review bulletproof.config.json and adjust settings if needed', 'info')
    print('  2. Make sure ANTHROPIC_API_KEY is set in your environment', 'info')
    print('  3. Try running: npx bulletproof run --no-push', 'info')
    console.log('')
  } else {
    print('BULLETPROOF setup completed with warnings.', 'warning')
    print('Please review the errors above and fix manually if needed.', 'warning')
    console.log('')
  }

  return {
    success: overallSuccess,
    projectInfo,
    steps: {
      husky: huskyResult,
      config: configResult,
      env: envResult,
    },
    errors,
  }
}

// Re-export types and utilities for external use
export * from './types.js'
export * from './detectors.js'
export { verifyHuskySetup } from './setup-husky.js'
export { verifyConfigSetup } from './setup-config.js'
export { checkApiKeyConfigured } from './setup-env.js'
