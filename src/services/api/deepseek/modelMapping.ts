import {
  getProviderSessionDefaultModel,
  providerModelLooksCanonical,
} from '../../../utils/providerSessionConfig.js'

const DEFAULT_MODEL_MAP: Record<string, string> = {
  'claude-sonnet-4-20250514': 'deepseek-chat',
  'claude-sonnet-4-5-20250929': 'deepseek-chat',
  'claude-sonnet-4-6': 'deepseek-chat',
  'claude-opus-4-20250514': 'deepseek-reasoner',
  'claude-opus-4-1-20250805': 'deepseek-reasoner',
  'claude-opus-4-5-20251101': 'deepseek-reasoner',
  'claude-opus-4-6': 'deepseek-reasoner',
  'claude-haiku-4-5-20251001': 'deepseek-chat',
  'claude-3-5-haiku-20241022': 'deepseek-chat',
  'claude-3-7-sonnet-20250219': 'deepseek-chat',
  'claude-3-5-sonnet-20241022': 'deepseek-chat',
}

const DEFAULT_FAMILY_MAP: Record<string, string> = {
  opus: 'deepseek-reasoner',
  sonnet: 'deepseek-chat',
  haiku: 'deepseek-chat',
}

function getModelFamily(model: string): 'haiku' | 'sonnet' | 'opus' | null {
  if (/haiku/i.test(model)) return 'haiku'
  if (/opus/i.test(model)) return 'opus'
  if (/sonnet/i.test(model)) return 'sonnet'
  return null
}

function getUserModelMap(): Record<string, string> | null {
  const raw = process.env.DEEPSEEK_MODEL_MAP
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>
    }
  } catch {}
  return null
}

export function resolveDeepSeekModel(anthropicModel: string): string {
  if (process.env.DEEPSEEK_MODEL) {
    return process.env.DEEPSEEK_MODEL
  }

  const cleanModel = anthropicModel.replace(/\[1m\]$/, '')
  const sessionDefaultModel = getProviderSessionDefaultModel('deepseek')
  if (sessionDefaultModel && providerModelLooksCanonical(cleanModel)) {
    return sessionDefaultModel
  }
  const family = getModelFamily(cleanModel)
  const userMap = getUserModelMap()
  if (userMap && family && userMap[family]) {
    return userMap[family]
  }

  if (family) {
    const providerEnvVar = `DEEPSEEK_DEFAULT_${family.toUpperCase()}_MODEL`
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
