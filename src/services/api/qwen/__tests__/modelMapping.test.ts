import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { resolveQwenModel } from '../modelMapping.js'
import {
  clearAllProviderSessionConfig,
  setProviderSessionConfig,
} from '../../../../utils/providerSessionConfig.js'

describe('resolveQwenModel', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    clearAllProviderSessionConfig()
    delete process.env.QWEN_MODEL
    delete process.env.QWEN_MODEL_MAP
    delete process.env.QWEN_DEFAULT_SONNET_MODEL
    delete process.env.QWEN_DEFAULT_OPUS_MODEL
    delete process.env.QWEN_DEFAULT_HAIKU_MODEL
    delete process.env.ANTHROPIC_DEFAULT_SONNET_MODEL
    delete process.env.ANTHROPIC_DEFAULT_OPUS_MODEL
    delete process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL
  })

  afterEach(() => {
    clearAllProviderSessionConfig()
    process.env = { ...originalEnv }
  })

  test('session-selected Qwen model overrides canonical Claude IDs', () => {
    setProviderSessionConfig('qwen', { defaultModel: 'qwen-max' })
    expect(resolveQwenModel('claude-sonnet-4-6')).toBe('qwen-max')
  })

  test('QWEN_MODEL env var takes highest priority', () => {
    process.env.QWEN_MODEL = 'qwen-custom'
    expect(resolveQwenModel('claude-sonnet-4-6')).toBe('qwen-custom')
  })

  test('maps opus models to qwen-max', () => {
    expect(resolveQwenModel('claude-opus-4-6')).toBe('qwen-max')
  })

  test('maps sonnet models to qwen-plus', () => {
    expect(resolveQwenModel('claude-sonnet-4-6')).toBe('qwen-plus')
  })

  test('maps haiku models to qwen-turbo', () => {
    expect(resolveQwenModel('claude-haiku-4-5-20251001')).toBe('qwen-turbo')
  })

  test('QWEN_MODEL_MAP overrides family mapping', () => {
    process.env.QWEN_MODEL_MAP =
      '{"opus":"qwen-max-latest","sonnet":"qwen-plus-latest","haiku":"qwen-turbo-latest"}'
    expect(resolveQwenModel('claude-opus-4-6')).toBe('qwen-max-latest')
    expect(resolveQwenModel('claude-sonnet-4-6')).toBe('qwen-plus-latest')
    expect(resolveQwenModel('claude-haiku-4-5-20251001')).toBe(
      'qwen-turbo-latest',
    )
  })
})
