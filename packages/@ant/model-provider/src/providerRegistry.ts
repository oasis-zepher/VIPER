import type { Anthropic } from '@anthropic-ai/sdk'
import type {
  AssistantMessage,
  Message,
  StreamEvent,
  SystemAPIErrorMessage,
} from './types/message.js'
import type { SystemPrompt } from './types/systemPrompt.js'

export type APIProvider =
  | 'firstParty'
  | 'bedrock'
  | 'vertex'
  | 'foundry'
  | 'openai'
  | 'gemini'
  | 'grok'

export type ProviderQueryFunction<
  Options = unknown,
  ThinkingConfig = unknown,
> = (
  messages: Message[],
  systemPrompt: SystemPrompt,
  tools: ProviderTools,
  signal: AbortSignal,
  options: Options,
  thinkingConfig: ThinkingConfig,
) => AsyncGenerator<
  StreamEvent | AssistantMessage | SystemAPIErrorMessage,
  void
>

export interface NonAnthropicAdapter<
  Options = unknown,
  ThinkingConfig = unknown,
> {
  kind: 'adapter'
  query: ProviderQueryFunction<Options, ThinkingConfig>
}

export interface AnthropicClientProvider {
  kind: 'client'
  createClient: (model: string) => Promise<Anthropic>
}

export type ProviderEntry<Options = unknown, ThinkingConfig = unknown> =
  | NonAnthropicAdapter<Options, ThinkingConfig>
  | AnthropicClientProvider

const registry = new Map<APIProvider, () => ProviderEntry<any, any>>()

export function registerProvider<Options = unknown, ThinkingConfig = unknown>(
  id: APIProvider,
  factory: () => ProviderEntry<Options, ThinkingConfig>,
): void {
  registry.set(id, factory as () => ProviderEntry<any, any>)
}

export function getProviderEntry<Options = unknown, ThinkingConfig = unknown>(
  id: APIProvider,
): ProviderEntry<Options, ThinkingConfig> | null {
  const factory = registry.get(id)
  return factory
    ? (factory() as ProviderEntry<Options, ThinkingConfig>)
    : null
}

export function isNonAnthropicProvider(id: APIProvider): boolean {
  return getProviderEntry(id)?.kind === 'adapter'
}

export type ProviderTool = unknown
export type ProviderTools = readonly ProviderTool[]
