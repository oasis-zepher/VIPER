/**
 * Reactive-compact subsystem.
 *
 * Automatically triggers compaction when the prompt is too long or a 413/withheld
 * response is received. Gated behind the REACTIVE_COMPACT feature flag.
 */
import type { Message } from 'src/types/message'
import type { CompactionResult } from './compact.js'

/** When true, only reactive compacts are allowed (no manual). */
export const isReactiveOnlyMode: () => boolean = () => false

/** Attempt a reactive compact when the prompt exceeds context limits. */
export const reactiveCompactOnPromptTooLong: (
  _messages: Message[],
  _cacheSafeParams: Record<string, unknown>,
  _options: { customInstructions?: string; trigger?: string },
) => Promise<{
  ok: boolean
  reason?: string
  result?: CompactionResult
}> = async () => ({ ok: false })

/** Feature gate. */
export const isReactiveCompactEnabled: () => boolean = () => false

/** Check whether a withheld-too-long message triggered reactive compact. */
export const isWithheldPromptTooLong: (_message: Message) => boolean = () => false

/** Check whether a message was withheld due to media size. */
export const isWithheldMediaSizeError: (_message: Message) => boolean = () => false

/** Try a reactive compact cycle. Returns null when disabled/no action needed. */
export const tryReactiveCompact: (_params: {
  hasAttempted: boolean
  querySource: string
  aborted: boolean
  messages: Message[]
  cacheSafeParams: Record<string, unknown>
}) => Promise<CompactionResult | null> = async () => null
