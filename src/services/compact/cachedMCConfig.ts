/**
 * Cached model-context (MC) configuration reader.
 *
 * Reads cached MC config state. Returns an empty object when the config
 * has not been fetched — the downstream code treats missing keys as defaults.
 */
export const getCachedMCConfig: () => {
  enabled?: boolean
  systemPromptSuggestSummaries?: boolean
  supportedModels?: string[]
  [key: string]: unknown
} = () => ({})
