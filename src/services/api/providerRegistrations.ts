/**
 * Built-in provider registrations.
 *
 * Called once at startup (lazy, on first provider lookup) to populate the
 * provider registry. Each provider registers either an adapter (non-Anthropic)
 * or a client factory (Anthropic-family).
 */

import { registerProvider, type ProviderEntry } from './providerRegistry.js'

// ─── Non-Anthropic adapters (lazy-imported) ─────────────────────────────

registerProvider('openai', (): ProviderEntry => ({
  kind: 'adapter',
  query: async function* (messages, systemPrompt, tools, signal, options, thinkingConfig) {
    const { queryModelOpenAI } = require('./openai/index.js') as typeof import('./openai/index.js')
    yield* queryModelOpenAI(messages, systemPrompt, tools, signal, options)
  },
}))

registerProvider('gemini', (): ProviderEntry => ({
  kind: 'adapter',
  query: async function* (messages, systemPrompt, tools, signal, options, thinkingConfig) {
    const { queryModelGemini } = require('./gemini/index.js') as typeof import('./gemini/index.js')
    yield* queryModelGemini(messages, systemPrompt, tools, signal, options, thinkingConfig)
  },
}))

registerProvider('grok', (): ProviderEntry => ({
  kind: 'adapter',
  query: async function* (messages, systemPrompt, tools, signal, options, thinkingConfig) {
    const { queryModelGrok } = require('./grok/index.js') as typeof import('./grok/index.js')
    yield* queryModelGrok(messages, systemPrompt, tools, signal, options)
  },
}))

// ─── Anthropic-family providers (delegate to client.ts) ─────────────────
// These register as 'client' kind. The actual client creation stays in
// client.ts (getAnthropicClient). This is just for completeness — claude.ts
// checks `kind === 'adapter'` and falls through to Anthropic logic otherwise.

registerProvider('firstParty', (): ProviderEntry => ({
  kind: 'client',
  createClient: async () => {
    // Handled by the existing getAnthropicClient() fallthrough in client.ts
    throw new Error('firstParty uses getAnthropicClient() directly')
  },
}))

registerProvider('bedrock', (): ProviderEntry => ({
  kind: 'client',
  createClient: async () => {
    throw new Error('bedrock uses getAnthropicClient() directly')
  },
}))

registerProvider('vertex', (): ProviderEntry => ({
  kind: 'client',
  createClient: async () => {
    throw new Error('vertex uses getAnthropicClient() directly')
  },
}))

registerProvider('foundry', (): ProviderEntry => ({
  kind: 'client',
  createClient: async () => {
    throw new Error('foundry uses getAnthropicClient() directly')
  },
}))
