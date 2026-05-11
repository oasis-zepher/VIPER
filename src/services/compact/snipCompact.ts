/**
 * Snip-compact subsystem.
 *
 * Manages history snipping — trimming old conversation messages to free context
 * window tokens. Gated behind the HISTORY_SNIP feature flag. When disabled,
 * isSnipRuntimeEnabled returns false and the entire subsystem is compiled out
 * via dynamic-require dead-code elimination.
 */
import type { Message } from 'src/types/message'

/** Check whether a message is an internal snip-registration marker (hidden from UI). */
export const isSnipMarkerMessage: (message: Message) => boolean = () => false

/** Execute snip compaction. Returns messages unchanged when disabled. */
export const snipCompactIfNeeded: (
  messages: Message[],
  _options?: { force?: boolean },
) => {
  messages: Message[]
  executed: boolean
  tokensFreed: number
  boundaryMessage?: Message
} = messages => ({
  messages,
  executed: false,
  tokensFreed: 0,
})

/** Feature gate: returns false when the HISTORY_SNIP flag is off. */
export const isSnipRuntimeEnabled: () => boolean = () => false

/** Whether the user should be nudged to snip (based on message count/age). */
export const shouldNudgeForSnips: (_messages: Message[]) => boolean = () => false

/** Nudge text shown in the UI when snipping is recommended. */
export const SNIP_NUDGE_TEXT = ''
