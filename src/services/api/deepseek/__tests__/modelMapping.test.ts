import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { resolveDeepSeekModel } from '../modelMapping.js'
import {
  clearAllProviderSessionConfig,
  setProviderSessionConfig,
} from '../../../../utils/providerSessionConfig.js'

describe('resolveDeepSeekModel', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    clearAllProviderSessionConfig()
    delete process.env.DEEPSEEK_MODEL
    delete process.env.DEEPSEEK_MODEL_MAP
    delete process.env.DEEPSEEK_DEFAULT_SONNET_MODEL
    delete process.env.DEEPSEEK_DEFAULT_OPUS_MODEL
    delete process.env.DEEPSEEK_DEFAULT_HAIKU_MODEL
    delete process.env.ANTHROPIC_DEFAULT_SONNET_MODEL
    delete process.env.ANTHROPIC_DEFAULT_OPUS_MODEL
    delete process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL
  })

  afterEach(() => {
    clearAllProviderSessionConfig()
    process.env = { ...originalEnv }
  })

  test('session-selected DeepSeek model overrides canonical Claude IDs', () => {
    setProviderSessionConfig('deepseek', { defaultModel: 'deepseek-chat' })
    expect(resolveDeepSeekModel('claude-opus-4-6')).toBe('deepseek-chat')
  })

  test('DEEPSEEK_MODEL env var takes highest priority', () => {
    process.env.DEEPSEEK_MODEL = 'deepseek-custom'
    expect(resolveDeepSeekModel('claude-sonnet-4-6')).toBe('deepseek-custom')
  })

  test('maps opus models to deepseek-reasoner', () => {
    expect(resolveDeepSeekModel('claude-opus-4-6')).toBe('deepseek-reasoner')
  })

  test('maps sonnet models to deepseek-chat', () => {
    expect(resolveDeepSeekModel('claude-sonnet-4-6')).toBe('deepseek-chat')
  })

  test('DEEPSEEK_MODEL_MAP overrides family mapping', () => {
    process.env.DEEPSEEK_MODEL_MAP =
      '{"opus":"deepseek-r1","sonnet":"deepseek-v3","haiku":"deepseek-lite"}'
    expect(resolveDeepSeekModel('claude-opus-4-6')).toBe('deepseek-r1')
    expect(resolveDeepSeekModel('claude-sonnet-4-6')).toBe('deepseek-v3')
    expect(resolveDeepSeekModel('claude-haiku-4-5-20251001')).toBe(
      'deepseek-lite',
    )
  })

  test('DEEPSEEK_DEFAULT_{FAMILY}_MODEL overrides default map', () => {
    process.env.DEEPSEEK_DEFAULT_SONNET_MODEL = 'deepseek-v3-0324'
    expect(resolveDeepSeekModel('claude-sonnet-4-6')).toBe('deepseek-v3-0324')
  })
})
