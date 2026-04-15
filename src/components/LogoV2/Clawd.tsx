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

const POSES: Record<ClawdPose, readonly string[]> = {
  default: [
    '   ▄███▄   ',
    '  █ ◉ ◉ █  ',
    '  █  ▄  █  ',
    '  ███████  ',
    '   ▀▀ ▀▀   ',
  ],
  'look-left': [
    '   ▄███▄   ',
    '  █ ◎ · █  ',
    '  █  ▄  █  ',
    '  ███████  ',
    '   ▀▀ ▀▀   ',
  ],
  'look-right': [
    '   ▄███▄   ',
    '  █ · ◎ █  ',
    '  █  ▄  █  ',
    '  ███████  ',
    '   ▀▀ ▀▀   ',
  ],
  'arms-up': [
    ' ▄█▄███▄█▄ ',
    '  █ ◉ ◉ █  ',
    '  █  ▄  █  ',
    '   █████   ',
    '   ▀▀ ▀▀   ',
  ],
}

export function Clawd({ pose = 'default' }: Props = {}): React.ReactNode {
  const lines = POSES[pose]

  return (
    <Box flexDirection="column" alignItems="center">
      {lines.map((line, index) => (
        <Text key={`${pose}-${index}`} color="white">
          {line}
        </Text>
      ))}
    </Box>
  )
}
