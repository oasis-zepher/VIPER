import type {
  BetaToolUnion,
  BetaUsage,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import type { TextBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import type { QuerySource } from 'src/constants/querySource.js'
import { getQuerySourceCacheDomain } from 'src/constants/querySource.js'
import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../analytics/index.js'

type CacheControl = {
  type?: string
  ttl?: string
  scope?: string
}

export type CacheMetricSupport =
  | 'anthropic_prompt_cache'
  | 'openai_cached_tokens'
  | 'not_reported'
  | 'unknown'

export type CacheMarkerSummary = {
  systemCacheMarkers: number
  toolCacheMarkers: number
  messageCacheMarkers: number
  totalCacheMarkers: number
  cacheTtl: 'none' | '5m' | '1h' | 'mixed'
  cacheScope: 'none' | 'org' | 'global' | 'mixed'
  cacheMarkerLocations: 'none' | 'system' | 'tool' | 'message' | 'mixed'
}

export type CacheDiagnosticsContext = {
  promptCacheEnabled?: boolean
  markerSummary?: CacheMarkerSummary
}

type UsageLike = Pick<
  BetaUsage,
  'input_tokens' | 'cache_creation_input_tokens' | 'cache_read_input_tokens'
>

type AnalyticsMetadataValue =
  | boolean
  | number
  | undefined
  | AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS

export type CacheDiagnosticsMetadata = Record<string, AnalyticsMetadataValue>

function getObjectCacheControl(value: unknown): CacheControl | undefined {
  if (!value || typeof value !== 'object') return undefined
  const maybe = (value as { cache_control?: unknown }).cache_control
  if (!maybe || typeof maybe !== 'object') return undefined
  return maybe as CacheControl
}

function summarizeControls(
  controls: CacheControl[],
): Pick<CacheMarkerSummary, 'cacheTtl' | 'cacheScope'> {
  if (controls.length === 0) {
    return { cacheTtl: 'none', cacheScope: 'none' }
  }

  const ttls = new Set(
    controls.map(control => (control.ttl === '1h' ? '1h' : '5m')),
  )
  const scopes = new Set(
    controls.map(control => (control.scope === 'global' ? 'global' : 'org')),
  )

  return {
    cacheTtl: ttls.size === 1 ? [...ttls][0]! : 'mixed',
    cacheScope: scopes.size === 1 ? [...scopes][0]! : 'mixed',
  }
}

function summarizeLocations({
  systemCacheMarkers,
  toolCacheMarkers,
  messageCacheMarkers,
}: Pick<
  CacheMarkerSummary,
  'systemCacheMarkers' | 'toolCacheMarkers' | 'messageCacheMarkers'
>): CacheMarkerSummary['cacheMarkerLocations'] {
  const locations = [
    systemCacheMarkers > 0 ? 'system' : null,
    toolCacheMarkers > 0 ? 'tool' : null,
    messageCacheMarkers > 0 ? 'message' : null,
  ].filter(
    (location): location is 'system' | 'tool' | 'message' => location !== null,
  )

  if (locations.length === 0) return 'none'
  if (locations.length === 1) return locations[0]!
  return 'mixed'
}

export function summarizeCacheControlMarkers({
  system,
  tools,
  messages,
}: {
  system?: ReadonlyArray<TextBlockParam>
  tools?: ReadonlyArray<BetaToolUnion | Record<string, unknown>>
  messages?: ReadonlyArray<unknown>
}): CacheMarkerSummary {
  const controls: CacheControl[] = []

  const systemCacheMarkers = (system ?? []).reduce((count, block) => {
    const control = getObjectCacheControl(block)
    if (!control) return count
    controls.push(control)
    return count + 1
  }, 0)

  const toolCacheMarkers = (tools ?? []).reduce((count, tool) => {
    const control = getObjectCacheControl(tool)
    if (!control) return count
    controls.push(control)
    return count + 1
  }, 0)

  let messageCacheMarkers = 0
  for (const message of messages ?? []) {
    const content =
      message && typeof message === 'object'
        ? ((message as { content?: unknown }).content ??
          (message as { message?: { content?: unknown } }).message?.content)
        : undefined
    if (!Array.isArray(content)) continue
    for (const block of content) {
      const control = getObjectCacheControl(block)
      if (!control) continue
      controls.push(control)
      messageCacheMarkers++
    }
  }

  const totalCacheMarkers =
    systemCacheMarkers + toolCacheMarkers + messageCacheMarkers
  const { cacheTtl, cacheScope } = summarizeControls(controls)

  return {
    systemCacheMarkers,
    toolCacheMarkers,
    messageCacheMarkers,
    totalCacheMarkers,
    cacheTtl,
    cacheScope,
    cacheMarkerLocations: summarizeLocations({
      systemCacheMarkers,
      toolCacheMarkers,
      messageCacheMarkers,
    }),
  }
}

export function getCacheInputTokens(usage: UsageLike): number {
  return (
    (usage.input_tokens ?? 0) +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0)
  )
}

export function getCacheHitRate(usage: UsageLike): number | undefined {
  const totalInputTokens = getCacheInputTokens(usage)
  if (totalInputTokens <= 0) return undefined
  return (usage.cache_read_input_tokens ?? 0) / totalInputTokens
}

export function getCacheMetricSupport(provider: string): CacheMetricSupport {
  if (
    provider === 'firstParty' ||
    provider === 'bedrock' ||
    provider === 'vertex' ||
    provider === 'foundry'
  ) {
    return 'anthropic_prompt_cache'
  }
  if (provider === 'openai') return 'openai_cached_tokens'
  if (provider === 'gemini' || provider === 'grok') return 'not_reported'
  return 'unknown'
}

export function buildCacheDiagnosticsMetadata({
  usage,
  querySource,
  provider,
  promptCacheEnabled,
  markerSummary,
}: {
  usage: UsageLike
  querySource: QuerySource | string
  provider: string
  promptCacheEnabled?: boolean
  markerSummary?: CacheMarkerSummary
}): CacheDiagnosticsMetadata {
  const cacheHitRate = getCacheHitRate(usage)
  const support = getCacheMetricSupport(provider)
  const summary = markerSummary ?? summarizeCacheControlMarkers({})
  const hasCacheMarkers = summary.totalCacheMarkers > 0

  return {
    cacheHitRate,
    cacheInputTokens: getCacheInputTokens(usage),
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreateTokens: usage.cache_creation_input_tokens ?? 0,
    promptCacheEnabled: promptCacheEnabled ?? hasCacheMarkers,
    cacheEligible: (promptCacheEnabled ?? false) || hasCacheMarkers,
    cacheMetricSupport:
      support as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    cacheDomain: getQuerySourceCacheDomain(
      querySource,
    ) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    systemCacheMarkers: summary.systemCacheMarkers,
    toolCacheMarkers: summary.toolCacheMarkers,
    messageCacheMarkers: summary.messageCacheMarkers,
    totalCacheMarkers: summary.totalCacheMarkers,
    cacheTtl:
      summary.cacheTtl as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    cacheScope:
      summary.cacheScope as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    cacheMarkerLocations:
      summary.cacheMarkerLocations as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  }
}
