import { describe, expect, test } from 'bun:test'
import {
  buildCacheDiagnosticsMetadata,
  getCacheHitRate,
  getCacheInputTokens,
  getCacheMetricSupport,
  summarizeCacheControlMarkers,
} from '../cacheDiagnostics.js'

describe('cache diagnostics', () => {
  test('computes cache input token denominator and hit rate', () => {
    const usage = {
      input_tokens: 100,
      cache_creation_input_tokens: 20,
      cache_read_input_tokens: 80,
    }

    expect(getCacheInputTokens(usage as any)).toBe(200)
    expect(getCacheHitRate(usage as any)).toBe(0.4)
    expect(
      getCacheHitRate({
        input_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      } as any),
    ).toBeUndefined()
  })

  test('summarizes cache marker count, ttl, scope, and location', () => {
    const summary = summarizeCacheControlMarkers({
      system: [
        {
          type: 'text',
          text: 'static',
          cache_control: { type: 'ephemeral', ttl: '1h', scope: 'global' },
        } as any,
      ],
      tools: [
        {
          name: 'Read',
          description: 'read',
          input_schema: {},
          cache_control: { type: 'ephemeral' },
        } as any,
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'hello',
              cache_control: { type: 'ephemeral' },
            },
          ],
        } as any,
      ],
    })

    expect(summary).toEqual({
      systemCacheMarkers: 1,
      toolCacheMarkers: 1,
      messageCacheMarkers: 1,
      totalCacheMarkers: 3,
      cacheTtl: 'mixed',
      cacheScope: 'mixed',
      cacheMarkerLocations: 'mixed',
    })
  })

  test('builds safe analytics metadata', () => {
    const metadata = buildCacheDiagnosticsMetadata({
      usage: {
        input_tokens: 100,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 100,
      } as any,
      querySource: 'repl_main_thread',
      provider: 'firstParty',
      promptCacheEnabled: true,
      markerSummary: summarizeCacheControlMarkers({}),
    })

    expect(metadata.cacheHitRate).toBe(0.5)
    expect(metadata.cacheDomain as unknown as string).toBe('main')
    expect(metadata.cacheMetricSupport as unknown as string).toBe(
      'anthropic_prompt_cache',
    )
    expect(metadata.cacheEligible).toBe(true)
  })

  test('marks provider cache metric support explicitly', () => {
    expect(getCacheMetricSupport('openai')).toBe('openai_cached_tokens')
    expect(getCacheMetricSupport('gemini')).toBe('not_reported')
    expect(getCacheMetricSupport('grok')).toBe('not_reported')
    expect(getCacheMetricSupport('unknown-provider')).toBe('unknown')
  })
})
