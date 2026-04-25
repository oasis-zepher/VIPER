// biome-ignore-all assist/source/organizeImports: extracted from hooks.ts
import {
  createBaseHookInput,
  executeHooks,
  executeHooksOutsideREPL,
  hasHookForEvent,
  TOOL_HOOK_EXECUTION_TIMEOUT_MS,
  type AggregatedHookResult,
  type HookBlockingError,
  type HookResult,
  type HookOutsideReplResult,
  hasBlockingResult,
  getSessionEndHookTimeoutMs,
  shouldSkipHookDueToTrust,
} from "../core.js"
import type { InstructionsLoadedHookInput } from "src/entrypoints/agentSdkTypes.js"
import { getSessionId } from "src/bootstrap/state.js"
import { type ElicitationResponse } from '../core.js'
import { getRegisteredHooks } from 'src/bootstrap/state.js'
import { getHooksConfigFromSnapshot } from 'src/utils/hooks/hooksConfigSnapshot.js'

export type InstructionsLoadReason =
  | 'session_start'
  | 'nested_traversal'
  | 'path_glob_match'
  | 'include'
  | 'compact'

export type InstructionsMemoryType = 'User' | 'Project' | 'Local' | 'Managed'

/**
 * Check if InstructionsLoaded hooks are configured (without executing them).
 * Callers should check this before invoking executeInstructionsLoadedHooks to avoid
 * building hook inputs for every instruction file when no hook is configured.
 *
 * Checks both settings-file hooks (getHooksConfigFromSnapshot) and registered
 * hooks (plugin hooks + SDK callback hooks via registerHookCallbacks). Session-
 * derived hooks (structured output enforcement etc.) are internal and not checked.
 */
export function hasInstructionsLoadedHook(): boolean {
  const snapshotHooks = getHooksConfigFromSnapshot()?.['InstructionsLoaded']
  if (snapshotHooks && snapshotHooks.length > 0) return true
  const registeredHooks = getRegisteredHooks()?.['InstructionsLoaded']
  if (registeredHooks && registeredHooks.length > 0) return true
  return false
}

/**
 * Execute InstructionsLoaded hooks when an instruction file (CLAUDE.md or
 * .claude/rules/*.md) is loaded into context. Fire-and-forget — this hook is
 * for observability/audit only and does not support blocking.
 *
 * Dispatch sites:
 * - Eager load at session start (getMemoryFiles in claudemd.ts)
 * - Eager reload after compaction (getMemoryFiles cache cleared by
 *   runPostCompactCleanup; next call reports load_reason: 'compact')
 * - Lazy load when Claude touches a file that triggers nested CLAUDE.md or
 *   conditional rules with paths: frontmatter (memoryFilesToAttachments in
 *   attachments.ts)
 */
export async function executeInstructionsLoadedHooks(
  filePath: string,
  memoryType: InstructionsMemoryType,
  loadReason: InstructionsLoadReason,
  options?: {
    globs?: string[]
    triggerFilePath?: string
    parentFilePath?: string
    timeoutMs?: number
  },
): Promise<void> {
  const {
    globs,
    triggerFilePath,
    parentFilePath,
    timeoutMs = TOOL_HOOK_EXECUTION_TIMEOUT_MS,
  } = options ?? {}

  const hookInput: InstructionsLoadedHookInput = {
    ...createBaseHookInput(undefined),
    hook_event_name: 'InstructionsLoaded',
    file_path: filePath,
    memory_type: memoryType,
    load_reason: loadReason,
    globs,
    trigger_file_path: triggerFilePath,
    parent_file_path: parentFilePath,
  }

  await executeHooksOutsideREPL({
    hookInput,
    timeoutMs,
    matchQuery: loadReason,
  })
}

