import OpenAI from 'openai'
import { getProxyFetchOptions } from 'src/utils/proxy.js'
import {
  getProviderSessionApiKey,
  getProviderSessionBaseUrl,
} from '../../../utils/providerSessionConfig.js'

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

let cachedClient: OpenAI | null = null

export function getQwenClient(options?: {
  maxRetries?: number
  fetchOverride?: typeof fetch
  source?: string
}): OpenAI {
  if (cachedClient) return cachedClient

  const client = new OpenAI({
    apiKey: getProviderSessionApiKey('qwen') || process.env.QWEN_API_KEY || '',
    baseURL:
      getProviderSessionBaseUrl('qwen') ||
      process.env.QWEN_BASE_URL ||
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

export function clearQwenClientCache(): void {
  cachedClient = null
}
