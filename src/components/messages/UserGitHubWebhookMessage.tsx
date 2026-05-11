import type { TextBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import * as React from 'react'
import { Box, Text } from '@anthropic/ink'

type Props = {
  addMargin: boolean
  param: TextBlockParam
}

const WEBHOOK_RE = /<github-webhook-activity>\n?([\s\S]*?)\n?<\/github-webhook-activity>/

export function UserGitHubWebhookMessage({
  param: { text },
  addMargin,
}: Props): React.ReactNode {
  const m = WEBHOOK_RE.exec(text)
  if (!m?.[1]) return null
  return (
    <Box flexDirection="row" marginTop={addMargin ? 1 : 0}>
      <Text dimColor>{m[1].trim()}</Text>
    </Box>
  )
}
