import {
  getProviderSessionDefaultModel,
  providerModelLooksCanonical,
} from '../../../utils/providerSessionConfig.js'

const DEFAULT_MODEL_MAP: Record<string, string> = {
  'claude-sonnet-4-20250514': 'qwen-plus',
  'claude-sonnet-4-5-20250929': 'qwen-plus',
  'claude-sonnet-4-6': 'qwen-plus',
  'claude-opus-4-20250514': 'qwen-max',
  'claude-opus-4-1-20250805': 'qwen-max',
  'claude-opus-4-5-20251101': 'qwen-max',
  'claude-opus-4-6': 'qwen-max',
  'claude-haiku-4-5-20251001': 'qwen-turbo',
  'claude-3-5-haiku-20241022': 'qwen-turbo',
  'claude-3-7-sonnet-20250219': 'qwen-plus',
  'claude-3-5-sonnet-20241022': 'qwen-plus',
}

const DEFAULT_FAMILY_MAP: Record<string, string> = {
  opus: 'qwen-max',
  sonnet: 'qwen-plus',
  haiku: 'qwen-turbo',
}

function getModelFamily(model: string): 'haiku' | 'sonnet' | 'opus' | null {
  if (/haiku/i.test(model)) return 'haiku'
  if (/opus/i.test(model)) return 'opus'
  if (/sonnet/i.test(model)) return 'sonnet'
  return null
}

function getUserModelMap(): Record<string, string> | null {
  const raw = process.env.QWEN_MODEL_MAP
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>
    }
  } catch {}
  return null
}

export function resolveQwenModel(anthropicModel: string): string {
  if (process.env.QWEN_MODEL) {
    return process.env.QWEN_MODEL
  }

  const cleanModel = anthropicModel.replace(/\[1m\]$/, '')
  const sessionDefaultModel = getProviderSessionDefaultModel('qwen')
  if (sessionDefaultModel && providerModelLooksCanonical(cleanModel)) {
    return sessionDefaultModel
  }
  const family = getModelFamily(cleanModel)
  const userMap = getUserModelMap()
  if (userMap && family && userMap[family]) {
    return userMap[family]
  }

  if (family) {
    const providerEnvVar = `QWEN_DEFAULT_${family.toUpperCase()}_MODEL`
    const providerOverride = process.env[providerEnvVar]
    if (providerOverride) return providerOverride

    const anthropicEnvVar = `ANTHROPIC_DEFAULT_${family.toUpperCase()}_MODEL`
    const anthropicOverride = process.env[anthropicEnvVar]
    if (anthropicOverride) return anthropicOverride
  }

  if (DEFAULT_MODEL_MAP[cleanModel]) {
    return DEFAULT_MODEL_MAP[cleanModel]
  }

  if (family && DEFAULT_FAMILY_MAP[family]) {
    return DEFAULT_FAMILY_MAP[family]
  }

  return cleanModel
}
