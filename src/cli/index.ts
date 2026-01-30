#!/usr/bin/env node
/**
 * BULLETPROOF CLI
 *
 * Command-line interface for the pre-push guardian.
 */

import { Command } from 'commander'
import { runGuardian } from '../guardian.js'
import { runInitWizard } from './init/index.js'

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
  .description('Initialize BULLETPROOF with automatic setup wizard')
  .option('--cwd <path>', 'Working directory (default: current directory)')
  .option('-y, --yes', 'Non-interactive mode - accept all defaults')
  .option('--skip-api-key', 'Skip API key prompt')
  .option('--verbose', 'Show detailed output')
  .action(async (options) => {
    try {
      const result = await runInitWizard({
        cwd: options.cwd,
        yes: options.yes,
        skipApiKey: options.skipApiKey,
        verbose: options.verbose,
      })

      process.exit(result.success ? 0 : 1)
    } catch (error) {
      console.error('Fatal error:', error)
      process.exit(1)
    }
  })

program.parse()
