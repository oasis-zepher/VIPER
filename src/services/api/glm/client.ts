import OpenAI from 'openai'
import { getProxyFetchOptions } from 'src/utils/proxy.js'
import {
  getProviderSessionApiKey,
  getProviderSessionBaseUrl,
} from '../../../utils/providerSessionConfig.js'

const DEFAULT_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4/'

let cachedClient: OpenAI | null = null

export function getGLMClient(options?: {
  maxRetries?: number
  fetchOverride?: typeof fetch
  source?: string
}): OpenAI {
  if (cachedClient) return cachedClient

  const client = new OpenAI({
    apiKey: getProviderSessionApiKey('glm') || process.env.GLM_API_KEY || '',
    baseURL:
      getProviderSessionBaseUrl('glm') ||
      process.env.GLM_BASE_URL ||
      DEFAULT_BASE_URL,
    maxRetries: options?.maxRetries ?? 0,
    timeout: parseInt(process.env.API_TIMEOUT_MS || String(600 * 1000), 10),
    dangerouslyAllowBrowser: true,
    fetchOptions: getProxyFetchOptions({ forAnthropicAPI: false }) as RequestInit,
    ...(options?.fetchOverride && { fetch: options.fetchOverride }),
  })

  if (!options?.fetchOverride) {
    cachedClient = client
  }

  return client
}

export function clearGLMClientCache(): void {
  cachedClient = null
}
