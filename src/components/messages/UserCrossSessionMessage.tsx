import type { TextBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import * as React from 'react'
import { Box, Text } from '@anthropic/ink'
import { CROSS_SESSION_MESSAGE_TAG } from '../../constants/xml.js'

type Props = {
  addMargin: boolean
  param: TextBlockParam
}

const CROSS_SESSION_RE = new RegExp(
  `<${CROSS_SESSION_MESSAGE_TAG}[^>]*>\\n?([\\s\\S]*?)\\n?</${CROSS_SESSION_MESSAGE_TAG}>`,
)

export function UserCrossSessionMessage({
  param: { text },
  addMargin,
}: Props): React.ReactNode {
  const m = CROSS_SESSION_RE.exec(text)
  if (!m?.[1]) return null
  return (
    <Box flexDirection="row" marginTop={addMargin ? 1 : 0}>
      <Text dimColor>{m[1].trim()}</Text>
    </Box>
  )
}
