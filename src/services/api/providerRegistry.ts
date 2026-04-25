/**
 * Pluggable provider registry for API providers.
 *
 * Replaces the if/else dispatch chains in claude.ts and client.ts with
 * a lookup table. Each provider registers either:
 *   - A `NonAnthropicAdapter` (openai, gemini, grok) — handles the full query
 *   - An `AnthropicClientProvider` (firstParty, bedrock, vertex, foundry) —
 *     creates an SDK client, shared query logic stays in claude.ts
 */

import type { Anthropic } from '@anthropic-ai/sdk'
import type {
  AssistantMessage,
  Message,
  StreamEvent,
  SystemAPIErrorMessage,
} from '../../types/message.js'
import type { SystemPrompt } from '../../utils/systemPromptType.js'
import type { Tools } from '../../Tool.js'
import type { ThinkingConfig } from '../../utils/thinking.js'
import type { APIProvider } from '../../utils/model/providers.js'

// Re-export so consumers can import from providerRegistry.ts
export type { APIProvider } from '../../utils/model/providers.js'

/** Options forwarded to query adapters. Import from claude.ts. */
export type { Options } from './claude.js'

/**
 * Query function signature shared by all non-Anthropic adapters.
 * Matches the async generator shape of queryModelOpenAI/Gemini/Grok.
 */
export type QueryFunction = (
  messages: Message[],
  systemPrompt: SystemPrompt,
  tools: Tools,
  signal: AbortSignal,
  options: import('./claude.js').Options,
  thinkingConfig: ThinkingConfig,
) => AsyncGenerator<
  StreamEvent | AssistantMessage | SystemAPIErrorMessage,
  void
>

/** Non-Anthropic provider: handles the full query via a custom adapter. */
export interface NonAnthropicAdapter {
  kind: 'adapter'
  query: QueryFunction
}

/** Anthropic-family provider: creates an SDK client, shared query logic. */
export interface AnthropicClientProvider {
  kind: 'client'
  createClient: (model: string) => Promise<Anthropic>
}

export type ProviderEntry = NonAnthropicAdapter | AnthropicClientProvider

const registry = new Map<APIProvider, () => ProviderEntry>()

/** Register a provider. The factory is called lazily on first access. */
export function registerProvider(
  id: APIProvider,
  factory: () => ProviderEntry,
): void {
  registry.set(id, factory)
}

/** Look up a provider entry by ID. Returns null if not registered. */
export function getProviderEntry(id: APIProvider): ProviderEntry | null {
  const factory = registry.get(id)
  return factory ? factory() : null
}

/** Check if a provider uses a non-Anthropic query adapter. */
export function isNonAnthropicProvider(id: APIProvider): boolean {
  const entry = getProviderEntry(id)
  return entry?.kind === 'adapter'
}
