import type { APIProvider } from './model/providers.js'

export type InteractiveAPIProvider =
  | 'openai'
  | 'glm'
  | 'deepseek'
  | 'qwen'
  | 'gemini'
  | 'grok'

type ProviderSessionConfig = {
  apiKey?: string
  baseUrl?: string
  defaultModel?: string
}

const providerSessionConfig = new Map<
  InteractiveAPIProvider,
  ProviderSessionConfig
>()

const PROVIDER_MODEL_SUGGESTIONS: Record<InteractiveAPIProvider, string[]> = {
  openai: ['gpt-5', 'gpt-5-mini', 'o3'],
  glm: ['glm-4-plus', 'glm-4-flash', 'glm-4-air'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  qwen: ['qwen-max', 'qwen-plus', 'qwen-turbo'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  grok: ['grok-4.20-reasoning', 'grok-3-mini-fast'],
}

export function isInteractiveAPIProvider(
  provider: string,
): provider is InteractiveAPIProvider {
  return (
    provider === 'openai' ||
    provider === 'glm' ||
    provider === 'deepseek' ||
    provider === 'qwen' ||
    provider === 'gemini' ||
    provider === 'grok'
  )
}

export function getProviderSessionConfig(
  provider: InteractiveAPIProvider,
): ProviderSessionConfig {
  return providerSessionConfig.get(provider) ?? {}
}

export function setProviderSessionConfig(
  provider: InteractiveAPIProvider,
  config: ProviderSessionConfig,
): void {
  providerSessionConfig.set(provider, {
    ...getProviderSessionConfig(provider),
    ...config,
  })
}

export function clearProviderSessionConfig(
  provider: InteractiveAPIProvider,
): void {
  providerSessionConfig.delete(provider)
}

export function getProviderSessionApiKey(
  provider: InteractiveAPIProvider,
): string | undefined {
  return getProviderSessionConfig(provider).apiKey
}

export function getProviderSessionDefaultModel(
  provider: InteractiveAPIProvider,
): string | undefined {
  return getProviderSessionConfig(provider).defaultModel
}

export function getProviderSessionBaseUrl(
  provider: InteractiveAPIProvider,
): string | undefined {
  return getProviderSessionConfig(provider).baseUrl
}

export function getProviderSuggestedModels(
  provider: InteractiveAPIProvider,
): string[] {
  return PROVIDER_MODEL_SUGGESTIONS[provider]
}

export function getProviderDefaultModelSeed(
  provider: InteractiveAPIProvider,
): string {
  const fromSession = getProviderSessionDefaultModel(provider)
  if (fromSession) return fromSession

  const providerModel = process.env[`${provider.toUpperCase()}_MODEL`]
  if (providerModel) return providerModel

  const providerDefaults = [
    process.env[`${provider.toUpperCase()}_DEFAULT_SONNET_MODEL`],
    process.env[`${provider.toUpperCase()}_DEFAULT_OPUS_MODEL`],
    process.env[`${provider.toUpperCase()}_DEFAULT_HAIKU_MODEL`],
  ].find(Boolean)
  if (providerDefaults) return providerDefaults

  return PROVIDER_MODEL_SUGGESTIONS[provider][0] ?? ''
}

export function getProviderDefaultBaseUrl(
  provider: InteractiveAPIProvider,
): string {
  switch (provider) {
    case 'openai':
      return process.env.OPENAI_BASE_URL ?? ''
    case 'glm':
      return process.env.GLM_BASE_URL ?? 'https://open.bigmodel.cn/api/paas/v4/'
    case 'deepseek':
      return process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
    case 'qwen':
      return (
        process.env.QWEN_BASE_URL ??
        'https://dashscope.aliyuncs.com/compatible-mode/v1'
      )
    case 'gemini':
      return (
        process.env.GEMINI_BASE_URL ??
        'https://generativelanguage.googleapis.com/v1beta'
      )
    case 'grok':
      return process.env.GROK_BASE_URL ?? 'https://api.x.ai/v1'
  }
}

export function getProviderExistingApiKey(
  provider: InteractiveAPIProvider,
): string {
  const fromSession = getProviderSessionApiKey(provider)
  if (fromSession) return fromSession

  switch (provider) {
    case 'openai':
      return process.env.OPENAI_API_KEY ?? ''
    case 'glm':
      return process.env.GLM_API_KEY ?? ''
    case 'deepseek':
      return process.env.DEEPSEEK_API_KEY ?? ''
    case 'qwen':
      return process.env.QWEN_API_KEY ?? ''
    case 'gemini':
      return process.env.GEMINI_API_KEY ?? ''
    case 'grok':
      return process.env.GROK_API_KEY ?? process.env.XAI_API_KEY ?? ''
  }
}

export function clearAllProviderSessionConfig(): void {
  providerSessionConfig.clear()
}

export function providerModelLooksCanonical(model: string): boolean {
  return /^(claude[-_]|haiku|sonnet|opus)/i.test(model)
}

export function isLikelyProviderAuthError(error: unknown): boolean {
  const status = (error as { status?: number } | undefined)?.status
  if (status === 401 || status === 403) {
    return true
  }

  const message =
    (error as { message?: string } | undefined)?.message?.toLowerCase() ?? ''
  return (
    message.includes('invalid api key') ||
    message.includes('incorrect api key') ||
    message.includes('authentication') ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('x-goog-api-key')
  )
}

export function getProviderAuthFailureMessage(
  provider: InteractiveAPIProvider,
): string {
  return `Authentication failed for ${provider}. Session credentials were cleared. Run /provider ${provider} to enter a new API key and model.`
}

export async function clearProviderClientCache(
  provider: APIProvider | InteractiveAPIProvider,
): Promise<void> {
  switch (provider) {
    case 'openai': {
      const { clearOpenAIClientCache } = await import(
        '../services/api/openai/client.js'
      )
      clearOpenAIClientCache()
      break
    }
    case 'glm': {
      const { clearGLMClientCache } = await import(
        '../services/api/glm/client.js'
      )
      clearGLMClientCache()
      break
    }
    case 'deepseek': {
      const { clearDeepSeekClientCache } = await import(
        '../services/api/deepseek/client.js'
      )
      clearDeepSeekClientCache()
      break
    }
    case 'qwen': {
      const { clearQwenClientCache } = await import(
        '../services/api/qwen/client.js'
      )
      clearQwenClientCache()
      break
    }
    case 'grok': {
      const { clearGrokClientCache } = await import(
        '../services/api/grok/client.js'
      )
      clearGrokClientCache()
      break
    }
    default:
      break
  }
}
