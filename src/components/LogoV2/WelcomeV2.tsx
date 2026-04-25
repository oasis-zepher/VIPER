import React from 'react'
import { Box, Text, useTheme } from '@anthropic/ink'
import { env } from '../../utils/env.js'
import { type Theme } from '../../utils/theme.js'

const WELCOME_V2_WIDTH = 58
const LIGHT_THEMES = ['light', 'light-daltonized', 'light-ansi']

type PenguinPalette = {
  body: keyof Theme
  faceBackground: keyof Theme
  faceDetail: keyof Theme
  beak: keyof Theme
  feet: keyof Theme
}

type PenguinWelcomeIconProps = {
  palette: PenguinPalette
  tails?: React.ReactNode[]
  groundPrefix?: string
  groundTail?: React.ReactNode
}

function PenguinWelcomeIcon({
  palette,
  tails = [],
  groundPrefix = '      ',
  groundTail = null,
}: PenguinWelcomeIconProps): React.ReactNode {
  return (
    <>
      <Text>
        {'      '}
        <Text color={palette.body}>{'  ▗▄▄▄▖  '}</Text>
        {tails[0]}
      </Text>
      <Text>
        {'      '}
        <Text color={palette.body}>{' ▟█████▙ '}</Text>
        {tails[1]}
      </Text>
      <Text>
        {'      '}
        <Text color={palette.body}>{'▟█'}</Text>
        <Text color={palette.faceBackground}>{'▗▄▄▄▖'}</Text>
        <Text color={palette.body}>{'█▙'}</Text>
        {tails[2]}
      </Text>
      <Text>
        {'      '}
        <Text color={palette.body}>{'██'}</Text>
        <Text
          color={palette.faceDetail}
          backgroundColor={palette.faceBackground}
        >
          {' • • '}
        </Text>
        <Text color={palette.body}>{'██'}</Text>
        {tails[3]}
      </Text>
      <Text>
        {'      '}
        <Text color={palette.body}>{'██'}</Text>
        <Text color={palette.beak} backgroundColor={palette.faceBackground}>
          {'  ▬  '}
        </Text>
        <Text color={palette.body}>{'██'}</Text>
        {tails[4]}
      </Text>
      <Text>
        {'      '}
        <Text color={palette.body}>{' ▜█'}</Text>
        <Text color={palette.faceBackground}>{'▝▄▄▄▘'}</Text>
        <Text color={palette.body}>{'█▛ '}</Text>
        {tails[5]}
      </Text>
      <Text>
        {groundPrefix}
        <Text color={palette.feet}>{'  ▔▔ ▔▔  '}</Text>
        {groundTail}
      </Text>
    </>
  )
}

export function WelcomeV2(): React.ReactNode {
  const [theme] = useTheme()
  const welcomeMessage = 'Welcome to Claude Code'
  const palette = getPenguinPalette(theme)

  if (env.terminal === 'Apple_Terminal') {
    return (
      <AppleTerminalWelcomeV2
        palette={palette}
        theme={theme}
        welcomeMessage={welcomeMessage}
      />
    )
  }

  if (LIGHT_THEMES.includes(theme)) {
    return (
      <Box width={WELCOME_V2_WIDTH}>
        <Text>
          <Text>
            <Text color="claude">{welcomeMessage} </Text>
            <Text dimColor>v{MACRO.VERSION} </Text>
          </Text>
          <Text>
            {'…………………………………………………………………………………………………………………………………………………………'}
          </Text>
          <Text>
            {'                                                          '}
          </Text>
          <Text>
            {'                                                          '}
          </Text>
          <Text>
            {'                                                          '}
          </Text>
          <Text>
            {'            ░░░░░░                                        '}
          </Text>
          <Text>
            {'    ░░░   ░░░░░░░░░░                                      '}
          </Text>
          <Text>
            {'   ░░░░░░░░░░░░░░░░░░░                                    '}
          </Text>
          <Text>
            {'                                                          '}
          </Text>
          <Text>
            <Text dimColor>{'                           ░░░░'}</Text>
            <Text>{'                     ██    '}</Text>
          </Text>
          <Text>
            <Text dimColor>{'                         ░░░░░░░░░░'}</Text>
            <Text>{'               ██▒▒██  '}</Text>
          </Text>
          <Text>
            {'                                            ▒▒      ██   ▒'}
          </Text>
          <PenguinWelcomeIcon
            palette={palette}
            tails={[
              '                         ▒▒░░▒▒      ▒ ▒▒',
              '                           ▒▒         ▒▒ ',
              '                           ▒▒         ▒▒ ',
              '                          ░          ▒   ',
            ]}
            groundPrefix="…………………"
            groundTail="……………………………………………………………………░…………………………▒…………"
          />
        </Text>
      </Box>
    )
  }

  return (
    <Box width={WELCOME_V2_WIDTH}>
      <Text>
        <Text>
          <Text color="claude">{welcomeMessage} </Text>
          <Text dimColor>v{MACRO.VERSION} </Text>
        </Text>
        <Text>
          {'…………………………………………………………………………………………………………………………………………………………'}
        </Text>
        <Text>
          {'                                                          '}
        </Text>
        <Text>
          {'     *                                       █████▓▓░     '}
        </Text>
        <Text>
          {'                                 *         ███▓░     ░░   '}
        </Text>
        <Text>
          {'            ░░░░░░                        ███▓░           '}
        </Text>
        <Text>
          {'    ░░░   ░░░░░░░░░░                      ███▓░           '}
        </Text>
        <Text>
          <Text>{'   ░░░░░░░░░░░░░░░░░░░    '}</Text>
          <Text bold>*</Text>
          <Text>{'                ██▓░░      ▓   '}</Text>
        </Text>
        <Text>
          {'                                             ░▓▓███▓▓░    '}
        </Text>
        <Text dimColor>
          {' *                                 ░░░░                   '}
        </Text>
        <Text dimColor>
          {'                                 ░░░░░░░░                 '}
        </Text>
        <Text dimColor>
          {'                               ░░░░░░░░░░░░░░░░           '}
        </Text>
        <PenguinWelcomeIcon
          palette={palette}
          tails={[
            <>
              {'                                       '}
              <Text dimColor>*</Text>
              <Text> </Text>
            </>,
            null,
            null,
            <>
              <Text>{'                        '}</Text>
              <Text bold>*</Text>
              <Text>{'                '}</Text>
            </>,
            '     *                                   ',
          ]}
          groundPrefix="…………………"
          groundTail="………………………………………………………………………………………………………………"
        />
      </Text>
    </Box>
  )
}

type AppleTerminalWelcomeV2Props = {
  palette: PenguinPalette
  theme: string
  welcomeMessage: string
}

function AppleTerminalWelcomeV2({
  palette,
  theme,
  welcomeMessage,
}: AppleTerminalWelcomeV2Props): React.ReactNode {
  const isLightTheme = LIGHT_THEMES.includes(theme)

  if (isLightTheme) {
    return (
      <Box width={WELCOME_V2_WIDTH}>
        <Text>
          <Text>
            <Text color="claude">{welcomeMessage} </Text>
            <Text dimColor>v{MACRO.VERSION} </Text>
          </Text>
          <Text>
            {'…………………………………………………………………………………………………………………………………………………………'}
          </Text>
          <Text>
            {'                                                          '}
          </Text>
          <Text>
            {'                                                          '}
          </Text>
          <Text>
            {'                                                          '}
          </Text>
          <Text>
            {'            ░░░░░░                                        '}
          </Text>
          <Text>
            {'    ░░░   ░░░░░░░░░░                                      '}
          </Text>
          <Text>
            {'   ░░░░░░░░░░░░░░░░░░░                                    '}
          </Text>
          <Text>
            {'                                                          '}
          </Text>
          <Text>
            <Text dimColor>{'                           ░░░░'}</Text>
            <Text>{'                     ██    '}</Text>
          </Text>
          <Text>
            <Text dimColor>{'                         ░░░░░░░░░░'}</Text>
            <Text>{'               ██▒▒██  '}</Text>
          </Text>
          <Text>
            {'                                            ▒▒      ██   ▒'}
          </Text>
          <Text>
            {'                                          ▒▒░░▒▒      ▒ ▒▒'}
          </Text>
          <PenguinWelcomeIcon
            palette={palette}
            tails={[
              '                           ▒▒         ▒▒ ',
              '                           ▒▒         ▒▒ ',
              '                           ▒▒         ▒▒ ',
              '                           ░          ▒   ',
            ]}
            groundPrefix="…………………"
            groundTail="……………………………………………………………………░…………………………▒…………"
          />
        </Text>
      </Box>
    )
  }

  return (
    <Box width={WELCOME_V2_WIDTH}>
      <Text>
        <Text>
          <Text color="claude">{welcomeMessage} </Text>
          <Text dimColor>v{MACRO.VERSION} </Text>
        </Text>
        <Text>
          {'…………………………………………………………………………………………………………………………………………………………'}
        </Text>
        <Text>
          {'                                                          '}
        </Text>
        <Text>
          {'     *                                       █████▓▓░     '}
        </Text>
        <Text>
          {'                                 *         ███▓░     ░░   '}
        </Text>
        <Text>
          {'            ░░░░░░                        ███▓░           '}
        </Text>
        <Text>
          {'    ░░░   ░░░░░░░░░░                      ███▓░           '}
        </Text>
        <Text>
          <Text>{'   ░░░░░░░░░░░░░░░░░░░    '}</Text>
          <Text bold>*</Text>
          <Text>{'                ██▓░░      ▓   '}</Text>
        </Text>
        <Text>
          {'                                             ░▓▓███▓▓░    '}
        </Text>
        <Text dimColor>
          {' *                                 ░░░░                   '}
        </Text>
        <Text dimColor>
          {'                                 ░░░░░░░░                 '}
        </Text>
        <Text dimColor>
          {'                               ░░░░░░░░░░░░░░░░           '}
        </Text>
        <PenguinWelcomeIcon
          palette={palette}
          tails={[
            <>
              {'                                       '}
              <Text dimColor>*</Text>
              <Text> </Text>
            </>,
            null,
            null,
            <>
              <Text>{'                        '}</Text>
              <Text bold>*</Text>
              <Text>{'                '}</Text>
            </>,
            '      *                                   ',
          ]}
          groundPrefix="…………………"
          groundTail="………………………………………………………………………………………………………………"
        />
      </Text>
    </Box>
  )
}

function getPenguinPalette(theme: string): PenguinPalette {
  const isLightTheme = LIGHT_THEMES.includes(theme)
  return {
    body: isLightTheme ? 'inactive' : 'inactiveShimmer',
    faceBackground: 'clawd_background',
    faceDetail: isLightTheme ? 'inverseText' : 'text',
    beak: 'warning',
    feet: 'warning',
  }
}
