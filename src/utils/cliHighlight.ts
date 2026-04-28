// highlight.js's type defs carry `/// <reference lib="dom" />`. SSETransport,
// mcp/client, ssh, dumpPrompts use DOM types (TextDecodeOptions, RequestInfo)
// that only typecheck because this file's highlight.js types pull lib.dom in.
// tsconfig has lib: ["ESNext"] only — fixing those DOM-type deps is separate.
/// <reference lib="dom" />

import chalk from 'chalk'
import { extname } from 'path'
import type { HLJSApi, LanguageFn } from 'highlight.js'

export type CliHighlight = {
  highlight(code: string, options?: { language?: string }): string
  supportsLanguage(name: string): boolean
}

type Style = (text: string) => string

const identity: Style = text => text

const TOKEN_STYLE: Record<string, Style> = {
  addition: chalk.green,
  attr: chalk.yellow,
  attribute: chalk.yellow,
  built_in: chalk.cyan,
  'builtin-name': chalk.cyan,
  bullet: chalk.green,
  class: chalk.yellow,
  comment: chalk.dim,
  deletion: chalk.red,
  doctag: chalk.magenta,
  emphasis: chalk.italic,
  keyword: chalk.cyan,
  literal: chalk.magenta,
  meta: chalk.dim,
  name: chalk.green,
  number: chalk.magenta,
  params: identity,
  property: chalk.yellow,
  quote: chalk.dim,
  regexp: chalk.red,
  section: chalk.cyan,
  selector_attr: chalk.yellow,
  selector_class: chalk.yellow,
  selector_id: chalk.yellow,
  selector_tag: chalk.green,
  string: chalk.green,
  strong: chalk.bold,
  subst: identity,
  symbol: chalk.yellow,
  tag: chalk.green,
  template_tag: chalk.cyan,
  template_variable: chalk.yellow,
  title: chalk.yellow,
  type: chalk.yellow,
  variable: chalk.yellow,
}

const ENTITY_REPLACEMENTS: Record<string, string> = {
  amp: '&',
  gt: '>',
  lt: '<',
  quot: '"',
  '#39': "'",
}

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(?:amp|gt|lt|quot|#39);/g, entity => {
    const key = entity.slice(1, -1)
    return ENTITY_REPLACEMENTS[key] ?? entity
  })
}

function styleForClass(className: string | undefined): Style {
  if (!className) return identity
  for (const rawToken of className.split(/\s+/)) {
    const token = rawToken.replace(/^hljs-/, '').replace(/-/g, '_')
    const style = TOKEN_STYLE[token]
    if (style) return style
  }
  return identity
}

function colorizeHighlightHtml(html: string): string {
  const tagRe = /<\/span>|<span\s+class="([^"]*)">/g
  const stack: Style[] = []
  let cursor = 0
  let output = ''

  function appendText(text: string): void {
    if (!text) return
    const decoded = decodeHtmlEntities(text)
    const style = stack[stack.length - 1] ?? identity
    output += style(decoded)
  }

  for (const match of html.matchAll(tagRe)) {
    appendText(html.slice(cursor, match.index))
    if (match[0] === '</span>') {
      stack.pop()
    } else {
      stack.push(styleForClass(match[1]))
    }
    cursor = match.index! + match[0].length
  }
  appendText(html.slice(cursor))
  return output
}

let cliHighlightPromise: Promise<CliHighlight | null> | undefined
let loadedGetLanguage: ((name: string) => { name: string } | undefined) | undefined

async function loadCliHighlight(): Promise<CliHighlight | null> {
  try {
    const mod = await import('highlight.js/lib/common')
    const hljs = ('default' in mod && mod.default ? mod.default : mod) as HLJSApi
    const dockerfile = await import('highlight.js/lib/languages/dockerfile')
    const defineDockerfile = (
      'default' in dockerfile && dockerfile.default
        ? dockerfile.default
        : dockerfile
    ) as LanguageFn
    hljs.registerLanguage('dockerfile', defineDockerfile)
    loadedGetLanguage = name => {
      const language = hljs.getLanguage(name)
      return language?.name ? { name: language.name } : undefined
    }

    return {
      highlight(code, options = {}) {
        const requestedLanguage = options.language || 'plaintext'
        const language = hljs.getLanguage(requestedLanguage)
          ? requestedLanguage
          : 'plaintext'
        return colorizeHighlightHtml(
          hljs.highlight(code, { language, ignoreIllegals: true }).value,
        )
      },
      supportsLanguage(name) {
        return !!hljs.getLanguage(name)
      },
    }
  } catch {
    return null
  }
}

export function getCliHighlightPromise(): Promise<CliHighlight | null> {
  cliHighlightPromise ??= loadCliHighlight()
  return cliHighlightPromise
}

/**
 * eg. "foo/bar.ts" -> "TypeScript". Awaits the shared highlighter load,
 * then reads highlight.js's language registry. All callers are telemetry
 * attributes or permissive UI paths, so callers already tolerate a Promise.
 */
export async function getLanguageName(file_path: string): Promise<string> {
  await getCliHighlightPromise()
  const ext = extname(file_path).slice(1)
  if (!ext) return 'unknown'
  return loadedGetLanguage?.(ext)?.name ?? 'unknown'
}
