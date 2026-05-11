import * as React from 'react'
import { Box, Text } from '@anthropic/ink'
import type { Message } from '../../types/message.js'

export function SnipBoundaryMessage({
  message,
}: {
  message: Message
}): React.ReactNode {
  const snipMeta = (message as { snipMetadata?: { removedUuids?: string[] } }).snipMetadata
  const removedCount = snipMeta?.removedUuids?.length ?? 0
  return (
    <Box flexDirection="row" paddingY={1}>
      <Text dimColor>
        {removedCount > 0
          ? `── SNIP (${removedCount} messages) ──`
          : '── SNIP ──'}
      </Text>
    </Box>
  )
}
