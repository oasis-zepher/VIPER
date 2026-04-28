import { describe, expect, test } from 'bun:test'
import {
  getProviderEntry,
  isNonAnthropicProvider,
  registerProvider,
} from '../providerRegistry.js'

describe('providerRegistry', () => {
  test('registers and resolves provider entries', () => {
    registerProvider('openai', () => ({
      kind: 'adapter',
      query: async function* () {},
    }))

    const entry = getProviderEntry('openai')
    expect(entry?.kind).toBe('adapter')
    expect(isNonAnthropicProvider('openai')).toBe(true)
  })

  test('distinguishes client providers from adapters', () => {
    registerProvider('foundry', () => ({
      kind: 'client',
      createClient: async () => {
        throw new Error('not used')
      },
    }))

    expect(getProviderEntry('foundry')?.kind).toBe('client')
    expect(isNonAnthropicProvider('foundry')).toBe(false)
  })
})
