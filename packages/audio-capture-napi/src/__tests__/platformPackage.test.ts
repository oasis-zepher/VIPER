import { describe, expect, test } from 'bun:test'
import { getAudioCaptureOptionalPackageName } from '../index.js'

describe('audio-capture optional platform packages', () => {
  test('maps supported platforms to package names', () => {
    expect(getAudioCaptureOptionalPackageName('darwin', 'arm64')).toBe(
      '@claude-code-best/audio-capture-darwin-arm64',
    )
    expect(getAudioCaptureOptionalPackageName('darwin', 'x64')).toBe(
      '@claude-code-best/audio-capture-darwin-x64',
    )
    expect(getAudioCaptureOptionalPackageName('linux', 'arm64')).toBe(
      '@claude-code-best/audio-capture-linux-arm64',
    )
    expect(getAudioCaptureOptionalPackageName('linux', 'x64')).toBe(
      '@claude-code-best/audio-capture-linux-x64',
    )
    expect(getAudioCaptureOptionalPackageName('win32', 'arm64')).toBe(
      '@claude-code-best/audio-capture-win32-arm64',
    )
    expect(getAudioCaptureOptionalPackageName('win32', 'x64')).toBe(
      '@claude-code-best/audio-capture-win32-x64',
    )
  })

  test('returns null for unsupported targets', () => {
    expect(getAudioCaptureOptionalPackageName('freebsd', 'x64')).toBeNull()
    expect(getAudioCaptureOptionalPackageName('linux', 'ia32')).toBeNull()
  })
})
