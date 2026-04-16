import type { SystemPrompt } from './systemPromptType.js'

const EXTERNAL_PROVIDER_SYSTEM_PROMPT_DYNAMIC_BOUNDARY =
  '__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__'

/**
 * Third-party providers should not receive Anthropic-only prompt metadata.
 *
 * These blocks are useful for Anthropic request attribution and cache control,
 * but they create a per-turn-varying prefix for external providers and hurt
 * automatic prompt cache hits.
 */
export function sanitizeSystemPromptForExternalProvider(
  systemPrompt: SystemPrompt,
): string[] {
  if (!systemPrompt || systemPrompt.length === 0) {
    return []
  }

  return systemPrompt.filter(
    block =>
      !!block &&
      block !== EXTERNAL_PROVIDER_SYSTEM_PROMPT_DYNAMIC_BOUNDARY &&
      !block.startsWith('x-anthropic-billing-header'),
  )
}

export function systemPromptToExternalText(systemPrompt: SystemPrompt): string {
  return sanitizeSystemPromptForExternalProvider(systemPrompt).join('\n\n')
}
