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

type Pixel =
  | 'empty'
  | 'outline'
  | 'body'
  | 'face'
  | 'eye-left'
  | 'eye-right'
  | 'beak'
  | 'feet'

const SPRITES: Record<ClawdPose, Pixel[][]> = {
  default: [
    [
      'empty',
      'empty',
      'outline',
      'outline',
      'outline',
      'outline',
      'outline',
      'empty',
      'empty',
    ],
    [
      'empty',
      'outline',
      'body',
      'face',
      'face',
      'face',
      'body',
      'outline',
      'empty',
    ],
    [
      'outline',
      'body',
      'face',
      'eye-left',
      'face',
      'eye-right',
      'face',
      'body',
      'outline',
    ],
    [
      'outline',
      'body',
      'face',
      'face',
      'beak',
      'face',
      'face',
      'body',
      'outline',
    ],
    [
      'outline',
      'body',
      'face',
      'face',
      'face',
      'face',
      'face',
      'body',
      'outline',
    ],
    [
      'outline',
      'body',
      'face',
      'face',
      'face',
      'face',
      'face',
      'body',
      'outline',
    ],
    [
      'empty',
      'outline',
      'body',
      'face',
      'face',
      'face',
      'body',
      'outline',
      'empty',
    ],
    [
      'empty',
      'empty',
      'feet',
      'empty',
      'empty',
      'empty',
      'feet',
      'empty',
      'empty',
    ],
  ],
  'look-left': [
    [
      'empty',
      'empty',
      'outline',
      'outline',
      'outline',
      'outline',
      'outline',
      'empty',
      'empty',
    ],
    [
      'empty',
      'outline',
      'body',
      'face',
      'face',
      'face',
      'body',
      'outline',
      'empty',
    ],
    [
      'outline',
      'body',
      'face',
      'eye-left',
      'eye-left',
      'face',
      'face',
      'body',
      'outline',
    ],
    [
      'outline',
      'body',
      'face',
      'face',
      'beak',
      'face',
      'face',
      'body',
      'outline',
    ],
    [
      'outline',
      'body',
      'face',
      'face',
      'face',
      'face',
      'face',
      'body',
      'outline',
    ],
    [
      'outline',
      'body',
      'face',
      'face',
      'face',
      'face',
      'face',
      'body',
      'outline',
    ],
    [
      'empty',
      'outline',
      'body',
      'face',
      'face',
      'face',
      'body',
      'outline',
      'empty',
    ],
    [
      'empty',
      'empty',
      'feet',
      'empty',
      'empty',
      'empty',
      'feet',
      'empty',
      'empty',
    ],
  ],
  'look-right': [
    [
      'empty',
      'empty',
      'outline',
      'outline',
      'outline',
      'outline',
      'outline',
      'empty',
      'empty',
    ],
    [
      'empty',
      'outline',
      'body',
      'face',
      'face',
      'face',
      'body',
      'outline',
      'empty',
    ],
    [
      'outline',
      'body',
      'face',
      'face',
      'eye-right',
      'eye-right',
      'face',
      'body',
      'outline',
    ],
    [
      'outline',
      'body',
      'face',
      'face',
      'beak',
      'face',
      'face',
      'body',
      'outline',
    ],
    [
      'outline',
      'body',
      'face',
      'face',
      'face',
      'face',
      'face',
      'body',
      'outline',
    ],
    [
      'outline',
      'body',
      'face',
      'face',
      'face',
      'face',
      'face',
      'body',
      'outline',
    ],
    [
      'empty',
      'outline',
      'body',
      'face',
      'face',
      'face',
      'body',
      'outline',
      'empty',
    ],
    [
      'empty',
      'empty',
      'feet',
      'empty',
      'empty',
      'empty',
      'feet',
      'empty',
      'empty',
    ],
  ],
  'arms-up': [
    [
      'outline',
      'empty',
      'outline',
      'outline',
      'outline',
      'outline',
      'outline',
      'empty',
      'outline',
    ],
    [
      'empty',
      'outline',
      'body',
      'face',
      'face',
      'face',
      'body',
      'outline',
      'empty',
    ],
    [
      'outline',
      'body',
      'face',
      'eye-left',
      'face',
      'eye-right',
      'face',
      'body',
      'outline',
    ],
    [
      'outline',
      'body',
      'face',
      'face',
      'beak',
      'face',
      'face',
      'body',
      'outline',
    ],
    [
      'outline',
      'body',
      'face',
      'face',
      'face',
      'face',
      'face',
      'body',
      'outline',
    ],
    [
      'outline',
      'body',
      'face',
      'face',
      'face',
      'face',
      'face',
      'body',
      'outline',
    ],
    [
      'empty',
      'outline',
      'body',
      'face',
      'face',
      'face',
      'body',
      'outline',
      'empty',
    ],
    [
      'empty',
      'empty',
      'feet',
      'empty',
      'empty',
      'empty',
      'feet',
      'empty',
      'empty',
    ],
  ],
}

function renderPixel(pixel: Pixel, key: string): React.ReactNode {
  switch (pixel) {
    case 'empty':
      return <Text key={key}>{'  '}</Text>
    case 'outline':
      return (
        <Text key={key} color="clawd_outline">
          {'██'}
        </Text>
      )
    case 'body':
      return (
        <Text key={key} color="clawd_body">
          {'██'}
        </Text>
      )
    case 'face':
      return (
        <Text key={key} color="clawd_background">
          {'██'}
        </Text>
      )
    case 'eye-left':
      return (
        <Text
          key={key}
          color="clawd_outline"
          backgroundColor="clawd_background"
        >
          {'● '}
        </Text>
      )
    case 'eye-right':
      return (
        <Text
          key={key}
          color="clawd_outline"
          backgroundColor="clawd_background"
        >
          {' ●'}
        </Text>
      )
    case 'beak':
      return (
        <Text key={key} color="clawd_beak" backgroundColor="clawd_background">
          {'▔▔'}
        </Text>
      )
    case 'feet':
      return (
        <Text key={key} color="clawd_feet">
          {'▄▄'}
        </Text>
      )
  }
}

export function Clawd({ pose = 'default' }: Props = {}): React.ReactNode {
  const sprite = SPRITES[pose]

  return (
    <Box flexDirection="column">
      {sprite.map((row, rowIndex) => (
        <Box key={`row-${rowIndex}`}>
          {row.map((pixel, columnIndex) =>
            renderPixel(pixel, `${rowIndex}-${columnIndex}`),
          )}
        </Box>
      ))}
    </Box>
  )
}
