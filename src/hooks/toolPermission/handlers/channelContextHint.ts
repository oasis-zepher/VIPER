import { CHANNEL_TAG } from '../../../constants/xml.js'

export type ChannelContextHint = {
  sourceServer?: string
  chatId?: string
}

function getTextBlocksText(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }
  if (!Array.isArray(content)) {
    return ''
  }
  return content
    .filter(
      (block): block is { type: 'text'; text: string } =>
        typeof block === 'object' &&
        block !== null &&
        (block as { type?: unknown }).type === 'text' &&
        typeof (block as { text?: unknown }).text === 'string',
    )
    .map(block => block.text)
    .join('\n')
}

function parseChannelContextHintFromText(
  text: string,
): ChannelContextHint | null {
  const tagMatch = text.match(new RegExp(`<${CHANNEL_TAG}\\b([^>]*)>`))
  if (!tagMatch?.[1]) {
    return null
  }

  const attrs = tagMatch[1]
  const sourceServer = attrs.match(/\bsource="([^"]+)"/)?.[1]
  const chatId = attrs.match(/\bchat_id="([^"]+)"/)?.[1]

  if (!sourceServer && !chatId) {
    return null
  }

  return { sourceServer, chatId }
}

export function getLatestChannelContextHint(
  messages: readonly unknown[],
): ChannelContextHint | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index] as {
      type?: unknown
      origin?: { kind?: unknown; server?: unknown }
      message?: { content?: unknown }
    }

    if (message?.type !== 'user' || message?.origin?.kind !== 'channel') {
      continue
    }

    const text = getTextBlocksText(message.message?.content)
    const parsed = parseChannelContextHintFromText(text)
    if (parsed) {
      return {
        sourceServer:
          parsed.sourceServer ||
          (typeof message.origin.server === 'string'
            ? message.origin.server
            : undefined),
        chatId: parsed.chatId,
      }
    }
  }

  return null
}
