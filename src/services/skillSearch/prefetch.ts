/**
 * Skill-discovery prefetch pipeline.
 *
 * Pre-fetches skill suggestions based on user input patterns (write-pivot
 * detection). When the EXPERIMENTAL_SKILL_SEARCH flag is off, returns
 * empty arrays — no skill discovery attachments are injected.
 */
import type { Attachment } from '../../utils/attachments.js'
import type { Message } from '../../types/message.js'
import type { ToolUseContext } from '../../Tool.js'

export const startSkillDiscoveryPrefetch: (
  _input: string | null,
  _messages: Message[],
  _toolUseContext: ToolUseContext,
) => Promise<Attachment[]> = async () => []

export const collectSkillDiscoveryPrefetch: (
  pending: Promise<Attachment[]>,
) => Promise<Attachment[]> = async pending => pending

export const getTurnZeroSkillDiscovery: (
  _input: string,
  _messages: Message[],
  _context: ToolUseContext,
) => Promise<Attachment | null> = async () => null
