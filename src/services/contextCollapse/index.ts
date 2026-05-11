/**
 * Context-collapse subsystem.
 *
 * Collapses verbose message spans (tool chains, search results) into compact
 * summary blocks to preserve context-window headroom. Gated behind CONTEXT_COLLAPSE.
 */
import type { Message } from '../../types/message.js'
import type { ToolUseContext } from '../../Tool.js'
import type { QuerySource } from '../../constants/querySource.js'

export interface ContextCollapseHealth {
  totalSpawns: number
  totalErrors: number
  lastError: string | null
  emptySpawnWarningEmitted: boolean
  totalEmptySpawns: number
}

export interface ContextCollapseStats {
  collapsedSpans: number
  collapsedMessages: number
  stagedSpans: number
  health: ContextCollapseHealth
}

export interface CollapseResult {
  messages: Message[]
}

export interface DrainResult {
  committed: number
  messages: Message[]
}

export const getStats: () => ContextCollapseStats = () => ({
  collapsedSpans: 0,
  collapsedMessages: 0,
  stagedSpans: 0,
  health: {
    totalSpawns: 0,
    totalErrors: 0,
    lastError: null,
    emptySpawnWarningEmitted: false,
    totalEmptySpawns: 0,
  },
})

export const isContextCollapseEnabled: () => boolean = () => false

export const subscribe: (_callback: () => void) => () => void = _callback => () => {}

export const applyCollapsesIfNeeded: (
  messages: Message[],
  _toolUseContext: ToolUseContext,
  _querySource: QuerySource,
) => Promise<CollapseResult> = async messages => ({ messages })

export const isWithheldPromptTooLong: (
  _message: Message,
  _isPromptTooLongMessage: (_msg: Message) => boolean,
  _querySource: QuerySource,
) => boolean = () => false

export const recoverFromOverflow: (
  messages: Message[],
  _querySource: QuerySource,
) => DrainResult = messages => ({ committed: 0, messages })

export const resetContextCollapse: () => void = () => {}

export const initContextCollapse: () => void = () => {}
