/**
 * Tests for banner rendering and cleanup
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { printSuccessBanner, printFailureBanner } from './banners.js'

const neonStop = vi.fn()
const glitchStop = vi.fn()

vi.mock('chalk-animation', () => ({
  default: {
    neon: vi.fn(() => ({ stop: neonStop })),
    glitch: vi.fn(() => ({ stop: glitchStop })),
  },
}))

describe('banners', () => {
  const originalWrite = process.stdout.write
  let writeSpy: any
  let logSpy: any

  beforeEach(() => {
    vi.useFakeTimers()
    writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    writeSpy.mockRestore()
    logSpy.mockRestore()
    process.stdout.write = originalWrite
    neonStop.mockClear()
    glitchStop.mockClear()
  })

  it('clears animated success banner before printing final output', async () => {
    const result = printSuccessBanner('41s', false, false)
    await vi.advanceTimersByTimeAsync(2500)
    await result

    const logOutput = logSpy.mock.calls.map((call: unknown[]) =>
      call.map(String).join(' ')
    )
    const bannerLogs = logOutput.filter((line: string) =>
      line.includes('BULLETPROOF')
    )
    expect(bannerLogs).toHaveLength(1)
    expect(
      writeSpy.mock.calls.some((call: unknown[]) =>
        String(call[0]).includes('\x1b[2K')
      )
    ).toBe(true)
    expect(
      writeSpy.mock.calls.some((call: unknown[]) =>
        String(call[0]).includes('\x1b[1A')
      )
    ).toBe(true)
  })

  it('clears animated failure banner before printing final output', async () => {
    const result = printFailureBanner('41s', false, false)
    await vi.advanceTimersByTimeAsync(2000)
    await result

    const logOutput = logSpy.mock.calls.map((call: unknown[]) =>
      call.map(String).join(' ')
    )
    const bannerLogs = logOutput.filter((line: string) =>
      line.includes('BULLETPROOF')
    )
    expect(bannerLogs).toHaveLength(1)
    expect(
      writeSpy.mock.calls.some((call: unknown[]) =>
        String(call[0]).includes('\x1b[2K')
      )
    ).toBe(true)
    expect(
      writeSpy.mock.calls.some((call: unknown[]) =>
        String(call[0]).includes('\x1b[1A')
      )
    ).toBe(true)
  })
})
