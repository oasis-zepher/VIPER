import React from 'react'
import { Box, Text, useTheme } from '@anthropic/ink'
import { env } from '../../utils/env.js'
import { type Theme } from '../../utils/theme.js'

const WELCOME_V2_WIDTH = 58
const LIGHT_THEMES = ['light', 'light-daltonized', 'light-ansi']

type PenguinPalette = {
  outline: keyof Theme
  faceBackground: keyof Theme
  eye: keyof Theme
  bellyBackground: keyof Theme
  beak: keyof Theme
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
          <Text>
            {'      '}
            <Text color={palette.outline}>{' ▗▄▄▄▄▄▖ '}</Text>
            {'                         ▒▒░░▒▒      ▒ ▒▒'}
          </Text>
          <Text>
            {'      '}
            <Text color={palette.outline}>{'▐ '}</Text>
            <Text
              color={palette.eye}
              backgroundColor={palette.faceBackground}
            >
              {' ◉ ◉ '}
            </Text>
            <Text color={palette.outline}>{' ▌'}</Text>
            {'                           ▒▒         ▒▒ '}
          </Text>
          <Text>
            {'      '}
            <Text color={palette.outline}>{'▐ '}</Text>
            <Text
              color={palette.beak}
              backgroundColor={palette.bellyBackground}
            >
              {'  ▾  '}
            </Text>
            <Text color={palette.outline}>{' ▌'}</Text>
            {'                          ░          ▒   '}
          </Text>
          <Text>
            {'…………………'}
            <Text color={palette.beak}>{'  ▝▘ ▝▝  '}</Text>
            {'……………………………………………………………………░…………………………▒…………'}
          </Text>
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
        <Text>
          {'      '}
          <Text color={palette.outline}>{' ▗▄▄▄▄▄▖ '}</Text>
          {'                                       '}
          <Text dimColor>*</Text>
          <Text> </Text>
        </Text>
        <Text>
          {'      '}
          <Text color={palette.outline}>{'▐ '}</Text>
          <Text color={palette.eye} backgroundColor={palette.faceBackground}>
            {' ◉ ◉ '}
          </Text>
          <Text color={palette.outline}>{' ▌'}</Text>
          <Text>{'                        '}</Text>
          <Text bold>*</Text>
          <Text>{'                '}</Text>
        </Text>
        <Text>
          {'      '}
          <Text color={palette.outline}>{'▐ '}</Text>
          <Text
            color={palette.beak}
            backgroundColor={palette.bellyBackground}
          >
            {'  ▾  '}
          </Text>
          <Text color={palette.outline}>{' ▌'}</Text>
          {'     *                                   '}
        </Text>
        <Text>
          {'…………………'}
          <Text color={palette.beak}>{'  ▝▘ ▝▝  '}</Text>
          {'………………………………………………………………………………………………………………'}
        </Text>
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
          <Text>
            {'      '}
            <Text color={palette.outline}>{' ▗▄▄▄▄▄▖ '}</Text>
            {'                           ▒▒         ▒▒ '}
          </Text>
          <Text>
            {'      '}
            <Text color={palette.outline}>{'▐ '}</Text>
            <Text
              color={palette.eye}
              backgroundColor={palette.faceBackground}
            >
              {' ◉ ◉ '}
            </Text>
            <Text color={palette.outline}>{' ▌'}</Text>
            {'                           ▒▒         ▒▒ '}
          </Text>
          <Text>
            {'      '}
            <Text color={palette.outline}>{'▐ '}</Text>
            <Text
              color={palette.beak}
              backgroundColor={palette.bellyBackground}
            >
              {'  ▾  '}
            </Text>
            <Text color={palette.outline}>{' ▌'}</Text>
            {'                           ░          ▒   '}
          </Text>
          <Text>
            {'…………………'}
            <Text color={palette.beak}>{'  ▝▘ ▝▝  '}</Text>
            {'……………………………………………………………………░…………………………▒…………'}
          </Text>
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
        <Text>
          {'      '}
          <Text color={palette.outline}>{' ▗▄▄▄▄▄▖ '}</Text>
          {'                                       '}
          <Text dimColor>*</Text>
          <Text> </Text>
        </Text>
        <Text>
          {'      '}
          <Text color={palette.outline}>{'▐ '}</Text>
          <Text color={palette.eye} backgroundColor={palette.faceBackground}>
            {' ◉ ◉ '}
          </Text>
          <Text color={palette.outline}>{' ▌'}</Text>
          <Text>{'                        '}</Text>
          <Text bold>*</Text>
          <Text>{'                '}</Text>
        </Text>
        <Text>
          {'      '}
          <Text color={palette.outline}>{'▐ '}</Text>
          <Text
            color={palette.beak}
            backgroundColor={palette.bellyBackground}
          >
            {'  ▾  '}
          </Text>
          <Text color={palette.outline}>{' ▌'}</Text>
          {'      *                                   '}
        </Text>
        <Text>
          {'…………………'}
          <Text color={palette.beak}>{'  ▝▘ ▝▝  '}</Text>
          {'………………………………………………………………………………………………………………'}
        </Text>
      </Text>
    </Box>
  )
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
