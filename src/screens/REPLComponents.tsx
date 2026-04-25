/**
 * Small components extracted from REPL.tsx.
 * TranscriptModeFooter, TranscriptSearchBar, AnimatedTerminalTitle.
 */

import React, { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import figures from 'figures'
import {
  Box,
  Text,
  useTerminalFocus,
  useTerminalTitle,
} from '@anthropic/ink'
import { useShortcutDisplay } from '../keybindings/useShortcutDisplay.js'
import { useSearchInput } from '../hooks/useSearchInput.js'
import type { JumpHandle } from '../components/VirtualMessageList.js'

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
    : sorted[mid]!
}

/**
 * Small component to display transcript mode footer with dynamic keybinding.
 * Must be rendered inside KeybindingSetup to access keybinding context.
 */
export function TranscriptModeFooter({
  showAllInTranscript,
  virtualScroll,
  searchBadge,
  suppressShowAll = false,
  status,
}: {
  showAllInTranscript: boolean
  virtualScroll: boolean
  searchBadge?: { current: number; count: number }
  suppressShowAll?: boolean
  status?: string
}): React.ReactNode {
  const toggleShortcut = useShortcutDisplay('app:toggleTranscript', 'Global', 'ctrl+o')
  const showAllShortcut = useShortcutDisplay('transcript:toggleShowAll', 'Transcript', 'ctrl+e')
  return (
    <Box
      noSelect
      alignItems="center"
      alignSelf="center"
      borderTopDimColor
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderStyle="single"
      marginTop={1}
      paddingLeft={2}
      width="100%"
    >
      <Text dimColor>
        Showing detailed transcript · {toggleShortcut} to toggle
        {searchBadge
          ? ' · n/N to navigate'
          : virtualScroll
            ? ` · ${figures.arrowUp}${figures.arrowDown} scroll · home/end top/bottom`
            : suppressShowAll
              ? ''
              : ` · ${showAllShortcut} to ${showAllInTranscript ? 'collapse' : 'show all'}`}
      </Text>
      {status ? (
        <>
          <Box flexGrow={1} />
          <Text>{status} </Text>
        </>
      ) : searchBadge ? (
        <>
          <Box flexGrow={1} />
          <Text dimColor>
            {searchBadge.current}/{searchBadge.count}
            {'  '}
          </Text>
        </>
      ) : null}
    </Box>
  )
}

/**
 * less-style / bar. 1-row, same border-top styling as TranscriptModeFooter
 * so swapping them in the bottom slot doesn't shift ScrollBox height.
 */
export function TranscriptSearchBar({
  jumpRef,
  count,
  current,
  onClose,
  onCancel,
  setHighlight,
  initialQuery,
}: {
  jumpRef: RefObject<JumpHandle | null>
  count: number
  current: number
  onClose: (lastQuery: string) => void
  onCancel: () => void
  setHighlight: (query: string) => void
  initialQuery: string
}): React.ReactNode {
  const { query, cursorOffset } = useSearchInput({
    isActive: true,
    initialQuery,
    onExit: () => onClose(query),
    onCancel,
  })
  const [indexStatus, setIndexStatus] = React.useState<'building' | { ms: number } | null>('building')
  React.useEffect(() => {
    let alive = true
    const warm = jumpRef.current?.warmSearchIndex
    if (!warm) {
      setIndexStatus(null)
      return
    }
    setIndexStatus('building')
    warm().then(ms => {
      if (!alive) return
      if (ms < 20) {
        setIndexStatus(null)
      } else {
        setIndexStatus({ ms })
        setTimeout(() => alive && setIndexStatus(null), 2000)
      }
    })
    return () => {
      alive = false
    }
  }, [])
  const warmDone = indexStatus !== 'building'
  useEffect(() => {
    if (!warmDone) return
    jumpRef.current?.setSearchQuery(query)
    setHighlight(query)
  }, [query, warmDone])
  const off = cursorOffset
  const cursorChar = off < query.length ? query[off] : ' '
  return (
    <Box
      borderTopDimColor
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderStyle="single"
      marginTop={1}
      paddingLeft={2}
      width="100%"
      noSelect
    >
      <Text>/</Text>
      <Text>{query.slice(0, off)}</Text>
      <Text inverse>{cursorChar}</Text>
      {off < query.length && <Text>{query.slice(off + 1)}</Text>}
      <Box flexGrow={1} />
      {indexStatus === 'building' ? (
        <Text dimColor>indexing… </Text>
      ) : indexStatus ? (
        <Text dimColor>indexed in {indexStatus.ms}ms </Text>
      ) : count === 0 && query ? (
        <Text color="error">no matches </Text>
      ) : count > 0 ? (
        <Text dimColor>
          {current}/{count}
          {'  '}
        </Text>
      ) : null}
    </Box>
  )
}

const TITLE_ANIMATION_FRAMES = ['⠂', '⠐']
const TITLE_STATIC_PREFIX = '✳'
const TITLE_ANIMATION_INTERVAL_MS = 960

/**
 * Sets the terminal tab title, with an animated prefix glyph while a query
 * is running. Isolated from REPL so the 960ms animation tick re-renders only
 * this leaf component (which returns null — pure side-effect) instead of the
 * entire REPL tree.
 */
export function AnimatedTerminalTitle({
  isAnimating,
  title,
  disabled,
  noPrefix,
}: {
  isAnimating: boolean
  title: string
  disabled: boolean
  noPrefix: boolean
}): null {
  const terminalFocused = useTerminalFocus()
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (disabled || noPrefix || !isAnimating || !terminalFocused) return
    const interval = setInterval(
      setFrame => setFrame(f => (f + 1) % TITLE_ANIMATION_FRAMES.length),
      TITLE_ANIMATION_INTERVAL_MS,
      setFrame,
    )
    return () => clearInterval(interval)
  }, [disabled, noPrefix, isAnimating, terminalFocused])
  const prefix = isAnimating ? (TITLE_ANIMATION_FRAMES[frame] ?? TITLE_STATIC_PREFIX) : TITLE_STATIC_PREFIX
  useTerminalTitle(disabled ? null : noPrefix ? title : `${prefix} ${title}`)
  return null
}
