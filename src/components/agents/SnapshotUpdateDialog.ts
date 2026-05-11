/**
 * Agent memory snapshot-update dialog.
 *
 * Prompts the user to merge, keep, or replace an agent's memory when a
 * time-based snapshot is due. Feature-gated behind agent memory snapshots.
 */
import type React from 'react'
import type { AgentMemoryScope } from '@claude-code-best/builtin-tools/tools/AgentTool/agentMemory.js'

export const SnapshotUpdateDialog: React.FC<{
  agentType: string
  scope: AgentMemoryScope
  snapshotTimestamp: string
  onComplete: (_choice: 'merge' | 'keep' | 'replace') => void
  onCancel: () => void
}> = () => null

export const buildMergePrompt: (
  _agentType: string,
  _scope: AgentMemoryScope,
) => string = () => ''
