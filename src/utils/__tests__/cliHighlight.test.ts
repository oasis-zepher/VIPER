import { describe, expect, test } from 'bun:test'
import { getCliHighlightPromise, getLanguageName } from '../cliHighlight.js'

describe('cliHighlight', () => {
  test('loads highlight.js common languages without leaking HTML', async () => {
    const highlighter = await getCliHighlightPromise()
    expect(highlighter).not.toBeNull()
    expect(highlighter!.supportsLanguage('typescript')).toBe(true)
    expect(highlighter!.supportsLanguage('ts')).toBe(true)

    const highlighted = highlighter!.highlight('const value = 1 < 2', {
      language: 'ts',
    })
    expect(highlighted).toContain('const')
    expect(highlighted).toContain('<')
    expect(highlighted).not.toContain('<span')
    expect(highlighted).not.toContain('&lt;')
  })

  test('falls back to plaintext for unknown languages', async () => {
    const highlighter = await getCliHighlightPromise()
    const highlighted = highlighter!.highlight('hello <world>', {
      language: 'definitely-not-a-language',
    })
    expect(highlighted).toBe('hello <world>')
  })

  test('reports display language names from the shared registry', async () => {
    expect(await getLanguageName('example.ts')).toBe('TypeScript')
  })
})
