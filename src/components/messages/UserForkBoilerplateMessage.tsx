import type { TextBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import * as React from 'react'
import { Box, Text } from '@anthropic/ink'
import { extractTag } from '../../utils/messages.js'

type Props = {
  addMargin: boolean
  param: TextBlockParam
}

export function UserForkBoilerplateMessage({
  param: { text },
  addMargin,
}: Props): React.ReactNode {
  const content = extractTag(text, 'fork-boilerplate')
  if (!content) return null
  return (
    <Box flexDirection="row" marginTop={addMargin ? 1 : 0}>
      <Text dimColor>{content.trim()}</Text>
    </Box>
  )
}
