#!/usr/bin/env node
/**
 * BULLETPROOF CLI
 *
 * Command-line interface for the pre-push guardian.
 */

import { Command } from 'commander'
import { runGuardian } from '../guardian.js'

const program = new Command()

program
  .name('bulletproof')
  .description('Pre-push guardian that uses Claude to run checks and auto-fix issues')
  .version('1.0.0')

program
  .command('run', { isDefault: true })
  .description('Run pre-push checks and auto-fix issues')
  .option('--no-push', 'Run checks but do not push to remote')
  .option('--hook', 'Run in git hook mode (mini logo, quick banners)')
  .option('--agent', 'Run in non-interactive agent mode (no animations)')
  .option('--verbose', 'Show detailed output from Claude')
  .option('--cwd <path>', 'Working directory (default: current directory)')
  .action(async (options) => {
    try {
      const result = await runGuardian({
        skipPush: options.noPush || options.hook,
        hookMode: options.hook,
        agentMode: options.agent,
        verbose: options.verbose,
        cwd: options.cwd,
      })

      process.exit(result.success ? 0 : 1)
    } catch (error) {
      console.error('Fatal error:', error)
      process.exit(1)
    }
  })

program
  .command('init')
  .description('Initialize BULLETPROOF configuration in the current project')
  .option('--cwd <path>', 'Working directory (default: current directory)')
  .action(async (options) => {
    const { existsSync, writeFileSync } = await import('fs')
    const { resolve } = await import('path')
    const cwd = options.cwd ?? process.cwd()

    const configPath = resolve(cwd, 'bulletproof.config.json')

    if (existsSync(configPath)) {
      console.log('bulletproof.config.json already exists')
      process.exit(1)
    }

    const defaultConfig = {
      model: 'claude-opus-4-5-20251101',
      maxTurns: 50,
      coverageThresholds: {
        lines: 90,
        statements: 90,
        functions: 78,
        branches: 80,
      },
      coverageScope: {
        include: ['src/**/*.ts', 'src/**/*.tsx'],
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
    }

    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2) + '\n')
    console.log('Created bulletproof.config.json')
    console.log('')
    console.log('Next steps:')
    console.log('1. Edit bulletproof.config.json to match your project')
    console.log('2. Run `npx bulletproof` to test')
    console.log('3. Add to your pre-push hook or CI pipeline')
  })

program.parse()
