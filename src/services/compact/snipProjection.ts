import type { Message } from 'src/types/message'

/** A snip boundary message has subtype 'snip_boundary' and marks older history as removed. */
export function isSnipBoundaryMessage(message: Message): boolean {
  return (
    message.type === 'system' &&
    (message as { subtype?: string }).subtype === 'snip_boundary'
  )
}

/** Project a snip-compacted view: remove messages that were marked as removed in snip boundaries. */
export function projectSnippedView(messages: Message[]): Message[] {
  const removedUuids = new Set<string>()
  for (const msg of messages) {
    if (isSnipBoundaryMessage(msg)) {
      const snipMeta = (msg as { snipMetadata?: { removedUuids?: string[] } }).snipMetadata
      if (snipMeta?.removedUuids) {
        for (const uuid of snipMeta.removedUuids) {
          removedUuids.add(uuid)
        }
      }
    }
  }

  if (removedUuids.size === 0) return messages

  // Keep only messages not in removedUuids, plus keep the boundary markers themselves
  return messages.filter(m => !removedUuids.has(m.uuid))
}
