import { describe, expect, test } from 'bun:test'
import {
  getPromptCacheTrackingKey,
  getQuerySourceCacheDomain,
  isOneShotQuerySource,
} from '../querySource.js'

describe('querySource cache classification', () => {
  test('classifies reusable conversation sources', () => {
    expect(getQuerySourceCacheDomain('repl_main_thread')).toBe('main')
    expect(
      getQuerySourceCacheDomain('repl_main_thread:outputStyle:Learning'),
    ).toBe('main')
    expect(getQuerySourceCacheDomain('sdk')).toBe('sdk')
    expect(getQuerySourceCacheDomain('agent:builtin:planner')).toBe('agent')
    expect(getQuerySourceCacheDomain('compact')).toBe('compact')
    expect(getQuerySourceCacheDomain('hook_agent')).toBe('hook')
  })

  test('classifies one-shot auxiliary sources', () => {
    expect(getQuerySourceCacheDomain('auto_mode')).toBe('classifier')
    expect(getQuerySourceCacheDomain('prompt_suggestion')).toBe('side-query')
    expect(getQuerySourceCacheDomain('session_memory')).toBe('tool-aux')
    expect(getQuerySourceCacheDomain('model_validation')).toBe('validation')
    expect(getQuerySourceCacheDomain('new_experiment')).toBe('unknown')
  })

  test('builds prompt cache tracking keys only for reusable domains', () => {
    expect(getPromptCacheTrackingKey('compact')).toBe('repl_main_thread')
    expect(getPromptCacheTrackingKey('agent:custom', 'agent-1')).toBe('agent-1')
    expect(getPromptCacheTrackingKey('hook_prompt')).toBe('hook_prompt')
    expect(getPromptCacheTrackingKey('prompt_suggestion')).toBeNull()
    expect(isOneShotQuerySource('session_memory')).toBe(true)
    expect(isOneShotQuerySource('repl_main_thread')).toBe(false)
  })
})
