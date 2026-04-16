import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { resolveGLMModel } from '../modelMapping.js'
import {
  clearAllProviderSessionConfig,
  setProviderSessionConfig,
} from '../../../../utils/providerSessionConfig.js'

describe('resolveGLMModel', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    clearAllProviderSessionConfig()
    delete process.env.GLM_MODEL
    delete process.env.GLM_MODEL_MAP
    delete process.env.GLM_DEFAULT_SONNET_MODEL
    delete process.env.GLM_DEFAULT_OPUS_MODEL
    delete process.env.GLM_DEFAULT_HAIKU_MODEL
    delete process.env.ANTHROPIC_DEFAULT_SONNET_MODEL
    delete process.env.ANTHROPIC_DEFAULT_OPUS_MODEL
    delete process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL
  })

  afterEach(() => {
    clearAllProviderSessionConfig()
    process.env = { ...originalEnv }
  })

  test('session-selected GLM model overrides canonical Claude IDs', () => {
    setProviderSessionConfig('glm', { defaultModel: 'glm-4-plus' })
    expect(resolveGLMModel('claude-sonnet-4-6')).toBe('glm-4-plus')
  })

  test('GLM_MODEL env var takes highest priority', () => {
    process.env.GLM_MODEL = 'glm-custom'
    expect(resolveGLMModel('claude-sonnet-4-6')).toBe('glm-custom')
  })

  test('maps opus models to glm-4-plus', () => {
    expect(resolveGLMModel('claude-opus-4-6')).toBe('glm-4-plus')
  })

  test('maps sonnet models to glm-4-flash', () => {
    expect(resolveGLMModel('claude-sonnet-4-6')).toBe('glm-4-flash')
  })

  test('maps haiku models to glm-4-air', () => {
    expect(resolveGLMModel('claude-haiku-4-5-20251001')).toBe('glm-4-air')
  })

  test('GLM_MODEL_MAP overrides family mapping', () => {
    process.env.GLM_MODEL_MAP = '{"opus":"glm-z1","sonnet":"glm-z2","haiku":"glm-z3"}'
    expect(resolveGLMModel('claude-opus-4-6')).toBe('glm-z1')
    expect(resolveGLMModel('claude-sonnet-4-6')).toBe('glm-z2')
    expect(resolveGLMModel('claude-haiku-4-5-20251001')).toBe('glm-z3')
  })

  test('GLM_DEFAULT_{FAMILY}_MODEL overrides default map', () => {
    process.env.GLM_DEFAULT_OPUS_MODEL = 'glm-4.5'
    expect(resolveGLMModel('claude-opus-4-6')).toBe('glm-4.5')
  })
})
