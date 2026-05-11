/**
 * Ccshare transcript resume helpers.
 *
 * Ccshare is Anthropic's internal transcript-sharing service. These functions
 * parse ccshare URLs and load shared transcripts for session resume.
 * Stubbed in external builds — ccshare is only accessible inside Anthropic.
 */
import type { LogOption } from 'src/types/logs.js'

/** Extract a ccshare ID from a resume argument (e.g., a ccshare URL). */
export const parseCcshareId: (_resume: string) => string | null = () => null

/** Load a ccshare transcript by ID. Throws in external builds. */
export const loadCcshare: (_ccshareId: string) => Promise<LogOption> = async () => {
  throw new Error('Ccshare is not available in external builds')
}
