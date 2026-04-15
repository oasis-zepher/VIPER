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

type Segment = {
  text: string
  color?: string
  backgroundColor?: string
}

const BODY = 'white'
const OUTLINE = 'inactive'
const BEAK = 'warning'
const EYE_PATCH: Segment = {
  text: '  ◕  ◕  ',
  color: 'black',
  backgroundColor: BODY,
}

const LOOK_LEFT_PATCH: Segment = {
  text: ' ◕   ◕  ',
  color: 'black',
  backgroundColor: BODY,
}

const LOOK_RIGHT_PATCH: Segment = {
  text: '  ◕   ◕ ',
  color: 'black',
  backgroundColor: BODY,
}

const BELLY_PATCH: Segment = {
  text: '        ',
  backgroundColor: BODY,
}

const POSES: Record<ClawdPose, readonly Segment[][]> = {
  default: [
    [{ text: '    ▄████▄    ', color: BODY }],
    [
      { text: '  ▄█', color: OUTLINE },
      { text: '██████', color: BODY },
      { text: '█▄  ', color: OUTLINE },
    ],
    [{ text: ' ▐█', color: OUTLINE }, EYE_PATCH, { text: '█▌ ', color: OUTLINE }],
    [
      { text: ' ▐█', color: OUTLINE },
      {
        text: '   ▄▄   ',
        color: BEAK,
        backgroundColor: BODY,
      },
      { text: '█▌ ', color: OUTLINE },
    ],
    [{ text: ' ▐█', color: OUTLINE }, BELLY_PATCH, { text: '█▌ ', color: OUTLINE }],
    [{ text: '  ▜█', color: OUTLINE }, { text: '██████', color: BODY }, { text: '█▛  ', color: OUTLINE }],
    [{ text: '    ▟▘    ▝▙    ', color: BEAK }],
  ],
  'look-left': [
    [{ text: '    ▄████▄    ', color: BODY }],
    [
      { text: '  ▄█', color: OUTLINE },
      { text: '██████', color: BODY },
      { text: '█▄  ', color: OUTLINE },
    ],
    [{ text: ' ▐█', color: OUTLINE }, LOOK_LEFT_PATCH, { text: '█▌ ', color: OUTLINE }],
    [
      { text: ' ▐█', color: OUTLINE },
      {
        text: '   ▄▄   ',
        color: BEAK,
        backgroundColor: BODY,
      },
      { text: '█▌ ', color: OUTLINE },
    ],
    [{ text: ' ▐█', color: OUTLINE }, BELLY_PATCH, { text: '█▌ ', color: OUTLINE }],
    [{ text: '  ▜█', color: OUTLINE }, { text: '██████', color: BODY }, { text: '█▛  ', color: OUTLINE }],
    [{ text: '    ▟▘    ▝▙    ', color: BEAK }],
  ],
  'look-right': [
    [{ text: '    ▄████▄    ', color: BODY }],
    [
      { text: '  ▄█', color: OUTLINE },
      { text: '██████', color: BODY },
      { text: '█▄  ', color: OUTLINE },
    ],
    [{ text: ' ▐█', color: OUTLINE }, LOOK_RIGHT_PATCH, { text: '█▌ ', color: OUTLINE }],
    [
      { text: ' ▐█', color: OUTLINE },
      {
        text: '   ▄▄   ',
        color: BEAK,
        backgroundColor: BODY,
      },
      { text: '█▌ ', color: OUTLINE },
    ],
    [{ text: ' ▐█', color: OUTLINE }, BELLY_PATCH, { text: '█▌ ', color: OUTLINE }],
    [{ text: '  ▜█', color: OUTLINE }, { text: '██████', color: BODY }, { text: '█▛  ', color: OUTLINE }],
    [{ text: '    ▟▘    ▝▙    ', color: BEAK }],
  ],
  'arms-up': [
    [{ text: ' ▄█▄██████▄█▄ ', color: OUTLINE }],
    [
      { text: '   █', color: OUTLINE },
      { text: '██████', color: BODY },
      { text: '█   ', color: OUTLINE },
    ],
    [{ text: '  ▐█', color: OUTLINE }, EYE_PATCH, { text: '█▌  ', color: OUTLINE }],
    [
      { text: '  ▐█', color: OUTLINE },
      {
        text: '   ▄▄   ',
        color: BEAK,
        backgroundColor: BODY,
      },
      { text: '█▌  ', color: OUTLINE },
    ],
    [{ text: '   █', color: OUTLINE }, BELLY_PATCH, { text: '█   ', color: OUTLINE }],
    [{ text: '    ▜', color: OUTLINE }, { text: '██████', color: BODY }, { text: '▛    ', color: OUTLINE }],
    [{ text: '     ▟▘  ▝▙     ', color: BEAK }],
  ],
}

export function Clawd({ pose = 'default' }: Props = {}): React.ReactNode {
  const lines = POSES[pose]

  return (
    <Box flexDirection="column" alignItems="center">
      {lines.map((line, index) => (
        <Text key={`${pose}-${index}`}>
          {line.map((segment, segmentIndex) => (
            <Text
              key={`${pose}-${index}-${segmentIndex}`}
              color={segment.color}
              backgroundColor={segment.backgroundColor}
            >
              {segment.text}
            </Text>
          ))}
        </Text>
      ))}
    </Box>
  )
}
