/**
 * Session-transcript persistence.
 *
 * Writes transcript segments to disk for later export/replay. No-op when
 * transcript recording is not configured.
 */
import type { Message } from '../../types/message.js'

export const writeSessionTranscriptSegment: (_messages: Message[]) => void = () => {}

export const flushOnDateChange: (_messages: Message[], _currentDate: string) => void = () => {}
