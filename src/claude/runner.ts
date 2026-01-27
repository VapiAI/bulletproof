/**
 * BULLETPROOF - Claude Agent SDK runner
 */

import { query } from '@anthropic-ai/claude-agent-sdk'
import type { BulletproofConfig } from '../config.js'
import type { DiffAnalysis } from '../diff/analyzer.js'
import { generatePrompt, generateSystemPrompt } from './prompt.js'
import type { SectionsState } from '../ui/sections.js'
import { updateSectionStatus, startSection } from '../ui/sections.js'
import { colors, gradients } from '../ui/colors.js'
import type { SpinnerState } from '../ui/spinner.js'
import { startSpinner, updateSpinner, stopSpinner } from '../ui/spinner.js'

/**
 * Options for the Claude runner
 */
export interface ClaudeRunnerOptions {
  config: BulletproofConfig
  analysis: DiffAnalysis
  hasConflicts: boolean
  sectionsState: SectionsState
  spinnerState: SpinnerState
  agentMode: boolean
  verbose: boolean
  cwd: string
}

/**
 * Result of running Claude
 */
export interface ClaudeRunnerResult {
  success: boolean
  error?: string
}

/**
 * Run the Claude agent to perform checks and fixes
 */
export async function runClaudeAgent(
  options: ClaudeRunnerOptions
): Promise<ClaudeRunnerResult> {
  const {
    config,
    analysis,
    hasConflicts,
    sectionsState,
    spinnerState,
    agentMode,
    verbose,
    cwd,
  } = options

  const prompt = generatePrompt(config, analysis, hasConflicts)
  const systemPrompt = generateSystemPrompt(config)

  const thresholds = config.coverageThresholds

  startSpinner(spinnerState, 'Analyzing codebase...', agentMode)

  let success = false

  try {
    for await (const message of query({
      prompt,
      options: {
        model: config.model,
        systemPrompt,
        maxTurns: config.maxTurns,
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        cwd,
      },
    })) {
      switch (message.type) {
        case 'assistant':
          if (message.message?.content) {
            for (const block of message.message.content) {
              if (block.type === 'text') {
                const shortText = block.text.split('\n')[0].substring(0, 60)
                updateSpinner(spinnerState, shortText, agentMode)

                // Check for success signal
                if (block.text.includes('ALL CHECKS PASSED')) {
                  success = true
                }

                // Show status reports prominently
                const lines = block.text.split('\n')
                for (const line of lines) {
                  // Detect section starts from text
                  if (
                    line.includes('.cursorrules') ||
                    line.includes('RULES COMPLIANCE') ||
                    line.includes('git diff HEAD')
                  ) {
                    startSection(
                      sectionsState,
                      'rules',
                      () => stopSpinner(spinnerState, agentMode),
                      agentMode
                    )
                  } else if (
                    line.includes('npm run typecheck') ||
                    line.includes('tsc')
                  ) {
                    startSection(
                      sectionsState,
                      'typecheck',
                      () => stopSpinner(spinnerState, agentMode),
                      agentMode
                    )
                  } else if (
                    line.includes('npm run test') &&
                    !line.includes('coverage')
                  ) {
                    startSection(
                      sectionsState,
                      'tests',
                      () => stopSpinner(spinnerState, agentMode),
                      agentMode
                    )
                  } else if (line.includes('coverage')) {
                    startSection(
                      sectionsState,
                      'coverage',
                      () => stopSpinner(spinnerState, agentMode),
                      agentMode
                    )
                  }

                  // Handle status updates
                  handleStatusLine(
                    line,
                    sectionsState,
                    spinnerState,
                    thresholds,
                    agentMode
                  )
                }

                if (verbose) {
                  stopSpinner(spinnerState, agentMode)
                  console.log(
                    `${colors.dim}${block.text.substring(0, 500)}${colors.reset}`
                  )
                  startSpinner(spinnerState, 'Working...', agentMode)
                }
              } else if (block.type === 'tool_use') {
                handleToolUse(
                  block,
                  sectionsState,
                  spinnerState,
                  agentMode
                )
              }
            }
          }
          break

        case 'result': {
          stopSpinner(spinnerState, agentMode)
          const resultMsg = message as {
            subtype: string
            errors?: unknown
          }
          if (resultMsg.subtype === 'success') {
            if (agentMode) {
              console.log('[COMPLETE] Analysis complete')
            } else {
              console.log(`  ${colors.dim}│${colors.reset}`)
              console.log(
                `  ${colors.green}●${colors.reset}  ${colors.dim}Analysis complete${colors.reset}`
              )
            }
          } else {
            const errorMsg = resultMsg.errors
              ? String(resultMsg.errors)
              : resultMsg.subtype
            if (agentMode) {
              console.log(`[STOPPED] ${errorMsg}`)
            } else {
              console.log(
                `  ${colors.red}○${colors.reset}  ${colors.dim}Stopped: ${errorMsg}${colors.reset}`
              )
            }
          }
          break
        }
      }
    }
  } catch (e) {
    stopSpinner(spinnerState, agentMode)
    console.error(`  ${colors.red}○${colors.reset}  Error:`, e)
    return { success: false, error: String(e) }
  }

  return { success }
}

/**
 * Handle status update lines from Claude's output
 */
function handleStatusLine(
  line: string,
  sectionsState: SectionsState,
  spinnerState: SpinnerState,
  thresholds: { lines: number; statements: number; functions: number; branches: number },
  agentMode: boolean
): void {
  if (line.includes('TYPECHECK PASSED')) {
    stopSpinner(spinnerState, agentMode)
    updateSectionStatus(sectionsState, 'typecheck', 'passed')
    if (agentMode) {
      console.log('[PASSED] Typecheck')
    } else {
      console.log(
        `  ${gradients.success('✓')}  ${colors.dim}Passed${colors.reset}`
      )
    }
    startSpinner(spinnerState, 'Moving to tests...', agentMode)
  } else if (line.includes('TYPECHECK FAILED')) {
    stopSpinner(spinnerState, agentMode)
    const match = line.match(/(\d+)\s*error/)
    const errCount = match ? match[1] : '?'
    updateSectionStatus(sectionsState, 'typecheck', 'failed')
    if (agentMode) {
      console.log(`[FAILED] Typecheck (${errCount} errors)`)
    } else {
      console.log(
        `  ${gradients.fail('✗')}  ${colors.dim}Failed${colors.reset} ${gradients.fail(`(${errCount} errors)`)}`
      )
    }
    startSpinner(spinnerState, 'Fixing type errors...', agentMode)
  } else if (line.includes('TESTS:') && line.includes('passed')) {
    stopSpinner(spinnerState, agentMode)
    const passMatch = line.match(/(\d+)\s*passed/)
    const failMatch = line.match(/(\d+)\s*failed/)
    const skipMatch = line.match(/(\d+)\s*skipped/)
    const passed = passMatch ? passMatch[1] : '?'
    const failed = failMatch ? failMatch[1] : '0'
    const skipped = skipMatch ? skipMatch[1] : '0'
    if (parseInt(failed) > 0) {
      updateSectionStatus(sectionsState, 'tests', 'failed')
      if (agentMode) {
        console.log(
          `[FAILED] Tests: ${passed} passed, ${failed} failed, ${skipped} skipped`
        )
      } else {
        console.log(
          `  ${gradients.fail('✗')}  ${colors.dim}${passed} passed,${colors.reset} ${gradients.fail(failed + ' failed')}${skipped !== '0' ? ` ${colors.dim}(${skipped} skipped)${colors.reset}` : ''}`
        )
      }
      startSpinner(spinnerState, 'Fixing failing tests...', agentMode)
    } else {
      updateSectionStatus(sectionsState, 'tests', 'passed')
      if (agentMode) {
        console.log(
          `[PASSED] Tests: ${passed} passed${skipped !== '0' ? `, ${skipped} skipped` : ''}`
        )
      } else {
        console.log(
          `  ${gradients.success('✓')}  ${colors.dim}${passed} passed${colors.reset}${skipped !== '0' ? ` ${colors.dim}(${skipped} skipped)${colors.reset}` : ''}`
        )
      }
      startSpinner(spinnerState, 'Moving to coverage...', agentMode)
    }
  } else if (line.includes('COVERAGE:') && line.includes('%')) {
    stopSpinner(spinnerState, agentMode)
    // Extract percentages
    const linesMatch = line.match(/Lines?\s*([\d.]+)%/)
    const stmtMatch = line.match(/Statements?\s*([\d.]+)%/)
    const funcMatch = line.match(/Functions?\s*([\d.]+)%/)
    const branchMatch = line.match(/Branches?\s*([\d.]+)%/)

    const linesP = linesMatch ? parseFloat(linesMatch[1]) : 0
    const stmtP = stmtMatch ? parseFloat(stmtMatch[1]) : 0
    const funcP = funcMatch ? parseFloat(funcMatch[1]) : 0
    const branchP = branchMatch ? parseFloat(branchMatch[1]) : 0

    const linesOk = linesP >= thresholds.lines
    const stmtOk = stmtP >= thresholds.statements
    const funcOk = funcP >= thresholds.functions
    const branchOk = branchP >= thresholds.branches
    const allOk = linesOk && stmtOk && funcOk && branchOk

    if (agentMode) {
      if (allOk) {
        updateSectionStatus(sectionsState, 'coverage', 'passed')
        console.log(
          `[PASSED] Coverage: Lines ${linesP}%, Statements ${stmtP}%, Functions ${funcP}%, Branches ${branchP}%`
        )
      } else {
        updateSectionStatus(sectionsState, 'coverage', 'failed')
        console.log(
          `[FAILED] Coverage: Lines ${linesP}% (need ${thresholds.lines}%), Statements ${stmtP}% (need ${thresholds.statements}%), Functions ${funcP}% (need ${thresholds.functions}%), Branches ${branchP}% (need ${thresholds.branches}%)`
        )
      }
    } else {
      const linesStr = linesOk
        ? gradients.success(linesP + '%')
        : gradients.fail(linesP + '%')
      const stmtStr = stmtOk
        ? gradients.success(stmtP + '%')
        : gradients.fail(stmtP + '%')
      const funcStr = funcOk
        ? gradients.success(funcP + '%')
        : gradients.fail(funcP + '%')
      const branchStr = branchOk
        ? gradients.success(branchP + '%')
        : gradients.fail(branchP + '%')

      if (allOk) {
        updateSectionStatus(sectionsState, 'coverage', 'passed')
        console.log(
          `  ${gradients.success('✓')}  ${colors.dim}L:${colors.reset}${linesStr} ${colors.dim}S:${colors.reset}${stmtStr} ${colors.dim}F:${colors.reset}${funcStr} ${colors.dim}B:${colors.reset}${branchStr}`
        )
        startSpinner(spinnerState, 'Moving to rules check...', agentMode)
      } else {
        updateSectionStatus(sectionsState, 'coverage', 'failed')
        console.log(
          `  ${gradients.fail('✗')}  ${colors.dim}L:${colors.reset}${linesStr} ${colors.dim}S:${colors.reset}${stmtStr} ${colors.dim}F:${colors.reset}${funcStr} ${colors.dim}B:${colors.reset}${branchStr}`
        )
        startSpinner(spinnerState, 'Improving coverage...', agentMode)
      }
    }
  } else if (line.includes('RULES COMPLIANCE PASSED')) {
    stopSpinner(spinnerState, agentMode)
    updateSectionStatus(sectionsState, 'rules', 'passed')
    if (agentMode) {
      console.log('[PASSED] Rules compliance')
    } else {
      console.log(
        `  ${gradients.success('✓')}  ${colors.dim}Compliant${colors.reset}`
      )
    }
    startSpinner(spinnerState, 'Finalizing...', agentMode)
  } else if (
    line.includes('RULES COMPLIANCE:') &&
    !line.includes('PASSED')
  ) {
    stopSpinner(spinnerState, agentMode)
    const violations = line.replace(/.*RULES COMPLIANCE:\s*/, '').trim()
    updateSectionStatus(sectionsState, 'rules', 'failed')
    if (agentMode) {
      console.log(`[FAILED] Rules compliance: ${violations}`)
    } else {
      console.log(
        `  ${gradients.fail('✗')}  ${colors.dim}${violations}${colors.reset}`
      )
    }
    startSpinner(spinnerState, 'Fixing violations...', agentMode)
  }
}

/**
 * Handle tool use blocks from Claude's output
 */
function handleToolUse(
  block: { type: 'tool_use'; name: string; input: unknown },
  sectionsState: SectionsState,
  spinnerState: SpinnerState,
  agentMode: boolean
): void {
  stopSpinner(spinnerState, agentMode)
  const toolName = block.name
  const input = block.input as Record<string, unknown>
  const cmd = String(input.command || input.cmd || '')

  // Detect section changes from bash commands
  if (
    toolName === 'Bash' ||
    toolName === 'bash' ||
    toolName === 'execute_bash'
  ) {
    if (cmd.includes('cat .cursorrules') || cmd.includes('git diff HEAD')) {
      startSection(
        sectionsState,
        'rules',
        () => stopSpinner(spinnerState, agentMode),
        agentMode
      )
    } else if (
      cmd.includes('typecheck') ||
      (cmd.includes('tsc') && !cmd.includes('test'))
    ) {
      startSection(
        sectionsState,
        'typecheck',
        () => stopSpinner(spinnerState, agentMode),
        agentMode
      )
    } else if (cmd.includes('npm run test') && !cmd.includes('coverage')) {
      startSection(
        sectionsState,
        'tests',
        () => stopSpinner(spinnerState, agentMode),
        agentMode
      )
    } else if (cmd.includes('coverage')) {
      startSection(
        sectionsState,
        'coverage',
        () => stopSpinner(spinnerState, agentMode),
        agentMode
      )
    }
  }

  // Agent mode: simple tool output
  if (agentMode) {
    if (toolName === 'Read' || toolName === 'read_file') {
      const filePath = String(input.file_path || input.path || '')
      console.log(`[TOOL] read ${filePath}`)
    } else if (
      toolName === 'Write' ||
      toolName === 'write_file' ||
      toolName === 'Edit' ||
      toolName === 'edit_file'
    ) {
      const filePath = String(input.file_path || input.path || '')
      console.log(`[TOOL] edit ${filePath}`)
    } else if (
      toolName === 'Bash' ||
      toolName === 'bash' ||
      toolName === 'execute_bash'
    ) {
      console.log(`[TOOL] run: ${cmd.substring(0, 80)}`)
    } else if (
      toolName === 'Grep' ||
      toolName === 'grep' ||
      toolName === 'Search' ||
      toolName === 'search'
    ) {
      const pattern = String(input.pattern || input.query || '')
      console.log(`[TOOL] search: ${pattern}`)
    } else {
      console.log(`[TOOL] ${toolName}`)
    }
  } else {
    // Show tool usage with gradient formatting
    const pipe = colors.dim + '│' + colors.reset
    if (toolName === 'Read' || toolName === 'read_file') {
      const filePath = String(input.file_path || input.path || '')
        .split('/')
        .slice(-2)
        .join('/')
      console.log(
        `  ${pipe}  ${gradients.info('read')} ${colors.dim}${filePath}${colors.reset}`
      )
    } else if (
      toolName === 'Write' ||
      toolName === 'write_file' ||
      toolName === 'Edit' ||
      toolName === 'edit_file'
    ) {
      const filePath = String(input.file_path || input.path || '')
        .split('/')
        .slice(-2)
        .join('/')
      console.log(
        `  ${pipe}  ${gradients.success('edit')} ${gradients.bulletproof(filePath)}`
      )
    } else if (
      toolName === 'Bash' ||
      toolName === 'bash' ||
      toolName === 'execute_bash'
    ) {
      const displayCmd = cmd.substring(0, 50)
      console.log(
        `  ${pipe}  ${gradients.info('run')}  ${colors.dim}${displayCmd}${colors.reset}`
      )
    } else if (
      toolName === 'Grep' ||
      toolName === 'grep' ||
      toolName === 'Search' ||
      toolName === 'search'
    ) {
      const pattern = String(input.pattern || input.query || '').substring(
        0,
        30
      )
      console.log(
        `  ${pipe}  ${gradients.bulletproof('find')} ${colors.dim}${pattern}${colors.reset}`
      )
    } else if (
      toolName === 'ListFiles' ||
      toolName === 'list_files' ||
      toolName === 'LS' ||
      toolName === 'ls'
    ) {
      const dirPath = String(input.path || input.directory || '.')
        .split('/')
        .slice(-2)
        .join('/')
      console.log(
        `  ${pipe}  ${gradients.info('list')} ${colors.dim}${dirPath}${colors.reset}`
      )
    } else {
      console.log(`  ${pipe}  ${gradients.info(toolName.toLowerCase())}`)
    }
  }

  startSpinner(spinnerState, 'Working...', agentMode)
}
