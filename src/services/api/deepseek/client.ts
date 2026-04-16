import OpenAI from 'openai'
import { getProxyFetchOptions } from 'src/utils/proxy.js'
import {
  getProviderSessionApiKey,
  getProviderSessionBaseUrl,
} from '../../../utils/providerSessionConfig.js'

const DEFAULT_BASE_URL = 'https://api.deepseek.com'

let cachedClient: OpenAI | null = null

export function getDeepSeekClient(options?: {
  maxRetries?: number
  fetchOverride?: typeof fetch
  source?: string
}): OpenAI {
  if (cachedClient) return cachedClient

  const client = new OpenAI({
    apiKey:
      getProviderSessionApiKey('deepseek') ||
      process.env.DEEPSEEK_API_KEY ||
      '',
    baseURL:
      getProviderSessionBaseUrl('deepseek') ||
      process.env.DEEPSEEK_BASE_URL ||
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

export function clearDeepSeekClientCache(): void {
  cachedClient = null
}
