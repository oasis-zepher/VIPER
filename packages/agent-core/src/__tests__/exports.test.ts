import { describe, expect, test } from 'bun:test'
import { query, QueryEngine, ask } from '@claude-code-best/agent-core'

describe('agent-core exports', () => {
  test('exposes the canonical query API surface', () => {
    expect(typeof query).toBe('function')
    expect(typeof QueryEngine).toBe('function')
    expect(typeof ask).toBe('function')
  })
})
