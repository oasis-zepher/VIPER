import { afterEach, describe, expect, test } from 'bun:test'

const { createAdapter } = await import('../adapters/index')

const originalWebSearchAdapter = process.env.WEB_SEARCH_ADAPTER
const originalAnthropicBaseUrl = process.env.ANTHROPIC_BASE_URL

afterEach(() => {
  if (originalWebSearchAdapter === undefined) {
    delete process.env.WEB_SEARCH_ADAPTER
  } else {
    process.env.WEB_SEARCH_ADAPTER = originalWebSearchAdapter
  }

  if (originalAnthropicBaseUrl === undefined) {
    delete process.env.ANTHROPIC_BASE_URL
  } else {
    process.env.ANTHROPIC_BASE_URL = originalAnthropicBaseUrl
  }
})

describe('createAdapter', () => {
  test('reuses the same instance when the selected backend does not change', () => {
    process.env.WEB_SEARCH_ADAPTER = 'brave'

    const firstAdapter = createAdapter()
    const secondAdapter = createAdapter()

    expect(firstAdapter).toBe(secondAdapter)
    expect(firstAdapter.constructor.name).toBe('BraveSearchAdapter')
  })

  test('rebuilds the adapter when WEB_SEARCH_ADAPTER changes', () => {
    process.env.WEB_SEARCH_ADAPTER = 'brave'
    const braveAdapter = createAdapter()

    process.env.WEB_SEARCH_ADAPTER = 'bing'
    const bingAdapter = createAdapter()

    expect(bingAdapter).not.toBe(braveAdapter)
    expect(bingAdapter.constructor.name).toBe('BingSearchAdapter')
  })

  test('selects the API adapter for first-party Anthropic URLs', () => {
    delete process.env.WEB_SEARCH_ADAPTER
    process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com'

    expect(createAdapter().constructor.name).toBe('ApiSearchAdapter')
  })

  test('selects the Bing adapter for third-party Anthropic base URLs', () => {
    delete process.env.WEB_SEARCH_ADAPTER
    process.env.ANTHROPIC_BASE_URL = 'https://example.test'

    expect(createAdapter().constructor.name).toBe('BingSearchAdapter')
  })
})
