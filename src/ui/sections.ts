/**
 * BULLETPROOF - Section tracking and progress display
 */

import { colors, gradients } from './colors.js'
import { printGradientDivider } from './banners.js'
import type { ChecksConfig } from '../config.js'

/**
 * Section definition
 */
export interface Section {
  id: string
  name: string
  icon: string
}

/**
 * Section status
 */
export type SectionStatus = 'pending' | 'running' | 'passed' | 'failed'

/**
 * All possible sections in execution order
 */
export const ALL_SECTIONS: readonly Section[] = [
  { id: 'rules', name: 'Conventions', icon: '📋' },
  { id: 'lint', name: 'Lint', icon: '🔍' },
  { id: 'format', name: 'Format', icon: '✨' },
  { id: 'typecheck', name: 'Typecheck', icon: '⚡' },
  { id: 'build', name: 'Build', icon: '🔨' },
  { id: 'tests', name: 'Tests', icon: '🧪' },
  { id: 'coverage', name: 'Coverage', icon: '📊' },
] as const

/**
 * Sections state tracker
 */
export interface SectionsState {
  /** Active sections based on config */
  sections: Section[]
  /** Status of each section */
  statuses: SectionStatus[]
  /** Current section index (-1 = not started) */
  currentIndex: number
}

/**
 * Create initial sections state based on checks config
 */
export function createSectionsState(checks: ChecksConfig): SectionsState {
  const sections = ALL_SECTIONS.filter((s) => {
    if (s.id === 'rules') return checks.rules
    if (s.id === 'lint') return checks.lint
    if (s.id === 'format') return checks.format
    if (s.id === 'typecheck') return checks.typecheck
    if (s.id === 'build') return checks.build
    if (s.id === 'tests') return checks.tests
    if (s.id === 'coverage') return checks.coverage
    return true
  })

  return {
    sections,
    statuses: sections.map(() => 'pending'),
    currentIndex: -1,
  }
}

/**
 * Print section header with progress
 */
export function printSectionHeader(
  state: SectionsState,
  sectionIndex: number,
  agentMode: boolean = false
): void {
  const section = state.sections[sectionIndex]
  const progress = `${sectionIndex + 1}/${state.sections.length}`

  // Agent mode: simple text section header
  if (agentMode) {
    console.log()
    console.log(`--- [${progress}] ${section.name.toUpperCase()} ---`)
    return
  }

  console.log()

  // Progress bar showing all sections
  const progressBar = state.sections
    .map((_, i) => {
      if (i < sectionIndex) return gradients.success('●')
      if (i === sectionIndex) return gradients.bulletproof('◆')
      return colors.dim + '○' + colors.reset
    })
    .join(' ')

  // Fixed width layout: section name padded to fixed width, then progress on right
  const sectionName = `${section.icon}  ${section.name}`
  const paddedName = sectionName.padEnd(20) // Fixed width for section name area

  console.log(
    `  ${paddedName}${' '.repeat(26)}${progressBar} ${colors.dim}${progress}${colors.reset}`
  )
  printGradientDivider()
}

/**
 * Update section status
 */
export function updateSectionStatus(
  state: SectionsState,
  sectionId: string,
  status: 'passed' | 'failed'
): void {
  const index = state.sections.findIndex((s) => s.id === sectionId)
  if (index !== -1) {
    state.statuses[index] = status
  }
}

/**
 * Start a section (move to it if not already past it)
 */
export function startSection(
  state: SectionsState,
  sectionId: string,
  stopSpinnerFn: () => void,
  agentMode: boolean = false
): boolean {
  const index = state.sections.findIndex((s) => s.id === sectionId)
  // Only allow moving forward in sections, never backwards
  if (index !== -1 && index > state.currentIndex) {
    state.currentIndex = index
    state.statuses[index] = 'running'
    stopSpinnerFn()
    printSectionHeader(state, index, agentMode)
    return true
  }
  return false
}

/**
 * Print final summary of all sections
 */
export function printFinalSummary(
  state: SectionsState,
  agentMode: boolean = false
): void {
  console.log()

  // Agent mode: simple text summary
  if (agentMode) {
    console.log('=== SUMMARY ===')
    state.sections.forEach((section, i) => {
      const status = state.statuses[i]
      const statusText =
        status === 'passed'
          ? 'PASSED'
          : status === 'failed'
            ? 'FAILED'
            : status === 'running'
              ? 'RUNNING'
              : 'SKIPPED'
      console.log(`[${statusText}] ${section.name}`)
    })
    console.log()
    return
  }

  printGradientDivider()
  console.log()
  console.log(`  ${colors.bold}Summary${colors.reset}`)
  console.log()

  state.sections.forEach((section, i) => {
    const status = state.statuses[i]
    let icon: string
    let statusText: string

    switch (status) {
      case 'passed':
        icon = gradients.success('✓')
        statusText = gradients.success('passed')
        break
      case 'failed':
        icon = gradients.fail('✗')
        statusText = gradients.fail('failed')
        break
      case 'running':
        icon = colors.yellow + '◐' + colors.reset
        statusText = colors.yellow + 'running' + colors.reset
        break
      default:
        icon = colors.dim + '○' + colors.reset
        statusText = colors.dim + 'skipped' + colors.reset
    }

    console.log(
      `  ${icon}  ${section.icon} ${section.name.padEnd(12)} ${statusText}`
    )
  })

  console.log()
}

/**
 * Mark all running/pending sections as passed (for success case)
 */
export function markAllPassed(state: SectionsState): void {
  state.statuses = state.statuses.map((s) =>
    s === 'running' || s === 'pending' ? 'passed' : s
  )
}
