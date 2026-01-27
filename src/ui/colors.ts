/**
 * BULLETPROOF - Color definitions and ANSI codes
 */

import gradient from 'gradient-string'

/**
 * Gradient function type (matches gradient-string's GradientFunction)
 */
export interface GradientFunction {
  (str: string): string
  multiline: (str: string) => string
}

/**
 * ANSI color codes for terminal output
 */
export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
} as const

/**
 * Custom gradients for BULLETPROOF branding
 */
export const gradients: Record<string, GradientFunction> = {
  /** Main BULLETPROOF brand gradient: cyan -> purple -> pink */
  bulletproof: gradient(['#00d4ff', '#7c3aed', '#f472b6']),

  /** Success gradient: green shades */
  success: gradient(['#10b981', '#34d399', '#6ee7b7']),

  /** Failure gradient: red shades */
  fail: gradient(['#ef4444', '#f87171', '#fca5a5']),

  /** Info gradient: blue shades */
  info: gradient(['#3b82f6', '#60a5fa', '#93c5fd']),

  /** Warning gradient: yellow/orange shades */
  warning: gradient(['#f59e0b', '#fbbf24', '#fcd34d']),
}

/**
 * Apply a color code to text
 */
export function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`
}

/**
 * Make text bold
 */
export function bold(text: string): string {
  return `${colors.bold}${text}${colors.reset}`
}

/**
 * Make text dim
 */
export function dim(text: string): string {
  return `${colors.dim}${text}${colors.reset}`
}
