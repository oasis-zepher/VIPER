import { afterEach, describe, expect, test } from 'bun:test'
import {
  getHttpBridgeBaseUrlError,
  isHttpBridgeBaseUrlAllowed,
  LOCAL_RCS_ENV,
} from '../localRcs.js'

describe('local RCS HTTP URL policy', () => {
  const original = process.env[LOCAL_RCS_ENV]

  afterEach(() => {
    if (original === undefined) {
      delete process.env[LOCAL_RCS_ENV]
    } else {
      process.env[LOCAL_RCS_ENV] = original
    }
  })

  test('allows HTTPS and localhost HTTP by default', () => {
    expect(isHttpBridgeBaseUrlAllowed('https://rcs.example.com')).toBe(true)
    expect(isHttpBridgeBaseUrlAllowed('http://localhost:3000')).toBe(true)
    expect(isHttpBridgeBaseUrlAllowed('http://127.0.0.1:3000')).toBe(true)
  })

  test('rejects private LAN HTTP unless local RCS mode is explicit', () => {
    delete process.env[LOCAL_RCS_ENV]
    expect(isHttpBridgeBaseUrlAllowed('http://192.168.1.20:3000')).toBe(false)
    expect(getHttpBridgeBaseUrlError('http://192.168.1.20:3000')).toContain(
      'Only HTTPS or localhost HTTP',
    )
  })

  test('allows private LAN HTTP only in local RCS mode', () => {
    process.env[LOCAL_RCS_ENV] = '1'
    expect(isHttpBridgeBaseUrlAllowed('http://192.168.1.20:3000')).toBe(true)
    expect(isHttpBridgeBaseUrlAllowed('http://10.0.0.5:3000')).toBe(true)
    expect(isHttpBridgeBaseUrlAllowed('http://172.20.0.5:3000')).toBe(true)
    expect(isHttpBridgeBaseUrlAllowed('http://8.8.8.8:3000')).toBe(false)
  })
})
