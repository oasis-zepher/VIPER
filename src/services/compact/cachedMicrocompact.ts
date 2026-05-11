/**
 * Cached micro-compact subsystem.
 *
 * Manages cache-editing operations for micro-compaction — removing redundant
 * tool results from the model's context while keeping them in the UI.
 */
export interface CachedMCState {
  registeredTools: Set<string>
  toolOrder: string[]
  deletedRefs: Set<string>
  pinnedEdits: PinnedCacheEdits[]
  toolsSentToAPI: boolean
}

export interface CacheEditsBlock {
  type: 'cache_edits'
  edits: Array<{ type: string; tool_use_id: string }>
}

export interface PinnedCacheEdits {
  userMessageIndex: number
  block: CacheEditsBlock
}

export const isCachedMicrocompactEnabled: () => boolean = () => false

export const isModelSupportedForCacheEditing: (_model: string) => boolean = () => false

export const getCachedMCConfig: () => {
  triggerThreshold: number
  keepRecent: number
} = () => ({ triggerThreshold: 0, keepRecent: 0 })

export const createCachedMCState: () => CachedMCState = () => ({
  registeredTools: new Set(),
  toolOrder: [],
  deletedRefs: new Set(),
  pinnedEdits: [],
  toolsSentToAPI: false,
})

export const markToolsSentToAPI: (_state: CachedMCState) => void = () => {}

export const resetCachedMCState: (_state: CachedMCState) => void = () => {}

export const registerToolResult: (_state: CachedMCState, _toolId: string) => void = () => {}

export const registerToolMessage: (_state: CachedMCState, _groupIds: string[]) => void = () => {}

export const getToolResultsToDelete: (_state: CachedMCState) => string[] = () => []

export const createCacheEditsBlock: (
  _state: CachedMCState,
  _toolIds: string[],
) => CacheEditsBlock | null = () => null
