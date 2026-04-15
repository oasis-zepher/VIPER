import * as React from 'react'
import { Box, Text } from '../../ink.js'

export type ClawdPose =
  | 'default'
  | 'arms-up'
  | 'look-left'
  | 'look-right'

type Props = {
  pose?: ClawdPose
}

const POSES: Record<ClawdPose, string[]> = {
  default: [
    '            ',
    '  .---.     ',
    '  (·>·)     ',
    ' /(   )\\    ',
    '  `---´     ',
  ],
  'arms-up': [
    '            ',
    '  .---.     ',
    '  (·>·)     ',
    ' |(   )|    ',
    '  `---´     ',
  ],
  'look-left': [
    '            ',
    '  .---.     ',
    '  (··>)     ',
    ' /(   )\\    ',
    '  `---´     ',
  ],
  'look-right': [
    '            ',
    '  .---.     ',
    '  (<··)     ',
    ' /(   )\\    ',
    '  `---´     ',
  ],
}

export function Clawd({ pose = 'default' }: Props = {}): React.ReactNode {
  const lines = POSES[pose]

  return (
    <Box flexDirection="column" alignItems="center">
      {lines.map((line, index) => (
        <Text key={`${pose}-${index}`}>{line}</Text>
      ))}
    </Box>
  )
}
