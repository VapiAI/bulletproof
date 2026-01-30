/**
 * BULLETPROOF - Convention file discovery
 *
 * Discovers and loads project convention files (CLAUDE.md, .cursorrules, etc.)
 */

import { existsSync, readFileSync, readdirSync, statSync, lstatSync } from 'fs'
import { join, resolve } from 'path'

/**
 * Convention file types in priority order (highest to lowest)
 */
export type ConventionType =
  | 'claude-md'        // CLAUDE.md (highest priority)
  | 'cursorrules'      // .cursorrules
  | 'cursor-rules-dir' // .cursor/rules/*
  | 'claude-settings'  // .claude/settings.json (lowest priority)

/**
 * Discovered convention file
 */
export interface ConventionFile {
  /** Absolute path to the file */
  path: string
  /** Type of convention file */
  type: ConventionType
  /** File size in bytes */
  size: number
  /** File content (may be truncated) */
  content: string
}

/**
 * Convention discovery configuration
 */
export interface ConventionDiscoveryConfig {
  /** Maximum size per file in bytes (default: 100KB) */
  maxFileSize: number
  /** Maximum combined size in bytes (default: 200KB) */
  maxCombinedSize: number
  /** Whether to include source markers (default: true) */
  includeSourceMarkers: boolean
}

/**
 * Default convention discovery configuration
 */
export const DEFAULT_CONVENTION_CONFIG: ConventionDiscoveryConfig = {
  maxFileSize: 100 * 1024, // 100KB
  maxCombinedSize: 200 * 1024, // 200KB
  includeSourceMarkers: true,
}

/**
 * Convention file locations in priority order
 */
const CONVENTION_LOCATIONS: Array<{
  path: string
  type: ConventionType
  isDirectory: boolean
}> = [
  { path: 'CLAUDE.md', type: 'claude-md', isDirectory: false },
  { path: '.cursorrules', type: 'cursorrules', isDirectory: false },
  { path: '.cursor/rules', type: 'cursor-rules-dir', isDirectory: true },
  { path: '.claude/settings.json', type: 'claude-settings', isDirectory: false },
]

/**
 * Check if a file is a valid UTF-8 text file
 */
function isValidTextFile(content: Buffer): boolean {
  // Check for null bytes (common in binary files)
  if (content.includes(0)) {
    return false
  }

  // Try to decode as UTF-8
  try {
    const text = content.toString('utf-8')
    // Check for replacement characters (invalid UTF-8)
    return !text.includes('\ufffd')
  } catch {
    return false
  }
}

/**
 * Check if a path is a symlink that could cause issues
 */
function isSafeToRead(filePath: string, visitedPaths: Set<string> = new Set()): boolean {
  try {
    const realPath = resolve(filePath)
    if (visitedPaths.has(realPath)) {
      // Circular symlink detected
      return false
    }

    const stats = lstatSync(filePath)
    if (stats.isSymbolicLink()) {
      visitedPaths.add(realPath)
      const target = readFileSync(filePath).toString()
      return isSafeToRead(target, visitedPaths)
    }

    return true
  } catch {
    return false
  }
}

/**
 * Load content from a file with size limit
 */
export function loadFileContent(
  filePath: string,
  maxSize: number
): { content: string; size: number; truncated: boolean } | null {
  try {
    if (!existsSync(filePath)) {
      return null
    }

    if (!isSafeToRead(filePath)) {
      return null
    }

    const stats = statSync(filePath)
    if (!stats.isFile()) {
      return null
    }

    const buffer = readFileSync(filePath)
    if (!isValidTextFile(buffer)) {
      return null
    }

    const size = buffer.length
    const truncated = size > maxSize
    const content = truncated
      ? buffer.slice(0, maxSize).toString('utf-8') + '\n... [truncated]'
      : buffer.toString('utf-8')

    return { content, size, truncated }
  } catch {
    return null
  }
}

/**
 * Load files from a directory
 */
function loadDirectoryFiles(
  dirPath: string,
  maxFileSize: number
): ConventionFile[] {
  const files: ConventionFile[] = []

  try {
    if (!existsSync(dirPath)) {
      return files
    }

    const stats = statSync(dirPath)
    if (!stats.isDirectory()) {
      return files
    }

    const entries = readdirSync(dirPath)
    for (const entry of entries) {
      const entryPath = join(dirPath, entry)
      const result = loadFileContent(entryPath, maxFileSize)
      if (result) {
        files.push({
          path: entryPath,
          type: 'cursor-rules-dir',
          size: result.size,
          content: result.content,
        })
      }
    }
  } catch {
    // Ignore directory read errors
  }

  return files
}

/**
 * Deduplicate content across convention files
 *
 * If the same content appears in multiple files, only keep the highest priority version
 */
export function deduplicateContent(
  files: ConventionFile[],
  priorityOrder: ConventionType[]
): ConventionFile[] {
  if (files.length <= 1) {
    return files
  }

  // Sort by priority (highest first)
  const sorted = [...files].sort((a, b) => {
    const aIndex = priorityOrder.indexOf(a.type)
    const bIndex = priorityOrder.indexOf(b.type)
    return aIndex - bIndex
  })

  // Track seen content (normalized)
  const seenContent = new Set<string>()
  const result: ConventionFile[] = []

  for (const file of sorted) {
    // Normalize content for comparison (trim whitespace, normalize line endings)
    const normalized = file.content.trim().replace(/\r\n/g, '\n')

    if (!seenContent.has(normalized)) {
      seenContent.add(normalized)
      result.push(file)
    }
  }

  return result
}

/**
 * Combine convention files into a single string with source markers
 */
export function combineConventions(
  files: ConventionFile[],
  includeSourceMarkers: boolean
): string {
  if (files.length === 0) {
    return ''
  }

  if (files.length === 1 && !includeSourceMarkers) {
    return files[0].content
  }

  const parts: string[] = []

  for (const file of files) {
    if (includeSourceMarkers) {
      parts.push(`# Source: ${file.path}\n\n${file.content}`)
    } else {
      parts.push(file.content)
    }
  }

  return parts.join('\n\n---\n\n')
}

/**
 * Discover convention files in a project
 */
export function discoverConventionFiles(
  cwd: string,
  config: Partial<ConventionDiscoveryConfig> = {}
): ConventionFile[] {
  const finalConfig: ConventionDiscoveryConfig = {
    ...DEFAULT_CONVENTION_CONFIG,
    ...config,
  }

  const discovered: ConventionFile[] = []
  let totalSize = 0

  // Priority order for deduplication
  const priorityOrder: ConventionType[] = [
    'claude-md',
    'cursorrules',
    'cursor-rules-dir',
    'claude-settings',
  ]

  for (const location of CONVENTION_LOCATIONS) {
    if (totalSize >= finalConfig.maxCombinedSize) {
      break
    }

    const fullPath = join(cwd, location.path)

    if (location.isDirectory) {
      const dirFiles = loadDirectoryFiles(fullPath, finalConfig.maxFileSize)
      for (const file of dirFiles) {
        if (totalSize + file.size <= finalConfig.maxCombinedSize) {
          discovered.push(file)
          totalSize += file.size
        }
      }
    } else {
      const result = loadFileContent(fullPath, finalConfig.maxFileSize)
      if (result) {
        if (totalSize + result.size <= finalConfig.maxCombinedSize) {
          discovered.push({
            path: fullPath,
            type: location.type,
            size: result.size,
            content: result.content,
          })
          totalSize += result.size
        }
      }
    }
  }

  // Deduplicate content
  return deduplicateContent(discovered, priorityOrder)
}

/**
 * Get the combined conventions string for use in prompts
 */
export function getConventionsForPrompt(
  cwd: string,
  config: Partial<ConventionDiscoveryConfig> = {}
): { content: string; files: ConventionFile[] } {
  const finalConfig: ConventionDiscoveryConfig = {
    ...DEFAULT_CONVENTION_CONFIG,
    ...config,
  }

  const files = discoverConventionFiles(cwd, finalConfig)
  const content = combineConventions(files, finalConfig.includeSourceMarkers)

  return { content, files }
}
