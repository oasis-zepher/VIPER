import * as React from 'react'
import { Box, Text, useTheme } from '@anthropic/ink'
import { env } from '../../utils/env.js'
import { type Theme } from '../../utils/theme.js'

export type ClawdPose =
  | 'default'
  | 'arms-up' // both arms raised (used during jump)
  | 'look-left' // both pupils shifted left
  | 'look-right' // both pupils shifted right

type Props = {
  pose?: ClawdPose
}

type PenguinPalette = {
  outline: keyof Theme
  faceBackground: keyof Theme
  eye: keyof Theme
  bellyBackground: keyof Theme
  beak: keyof Theme
}

const LIGHT_THEMES = ['light', 'light-daltonized', 'light-ansi']

const TOP_ROWS: Record<ClawdPose, string> = {
  default: ' ▗▄▄▄▄▄▖ ',
  'look-left': ' ▗▄▄▄▄▄▖ ',
  'look-right': ' ▗▄▄▄▄▄▖ ',
  'arms-up': '╲▗▄▄▄▄▄▖╱',
}

const EYES: Record<ClawdPose, string> = {
  default: ' ◉ ◉ ',
  'look-left': '◉◉   ',
  'look-right': '   ◉◉',
  'arms-up': ' ◉ ◉ ',
}

export function Clawd({ pose = 'default' }: Props = {}): React.ReactNode {
  const [theme] = useTheme()
  const palette = getPenguinPalette(theme)

  if (env.terminal === 'Apple_Terminal') {
    return <AppleTerminalClawd palette={palette} pose={pose} />
  }

  return (
    <PenguinArt palette={palette} pose={pose} />
  )
}

function PenguinArt({
  palette,
  pose,
}: {
  palette: PenguinPalette
  pose: ClawdPose
}): React.ReactNode {
  return (
    <Box flexDirection="column" alignItems="center">
      <Text>
        <Text color={palette.outline}>{TOP_ROWS[pose]}</Text>
      </Text>
      <Text>
        <Text color={palette.outline}>{'▐ '}</Text>
        <Text color={palette.eye} backgroundColor={palette.faceBackground}>
          {EYES[pose]}
        </Text>
        <Text color={palette.outline}>{' ▌'}</Text>
      </Text>
      <Text>
        <Text color={palette.outline}>{'▐ '}</Text>
        <Text color={palette.beak} backgroundColor={palette.bellyBackground}>
          {'  ▾  '}
        </Text>
        <Text color={palette.outline}>{' ▌'}</Text>
      </Text>
      <Text color={palette.beak}>
        {'  ▝▘ ▝▝  '}
      </Text>
    </Box>
  )
}

function AppleTerminalClawd({
  palette,
  pose,
}: {
  palette: PenguinPalette
  pose: ClawdPose
}): React.ReactNode {
  return <PenguinArt palette={palette} pose={pose} />
}

function getPenguinPalette(theme: string): PenguinPalette {
  const isLightTheme = LIGHT_THEMES.includes(theme)
  return {
    outline: 'text',
    faceBackground: isLightTheme ? 'text' : 'clawd_background',
    eye: isLightTheme ? 'inverseText' : 'text',
    bellyBackground: isLightTheme ? 'inverseText' : 'text',
    beak: 'warning',
  }
}
