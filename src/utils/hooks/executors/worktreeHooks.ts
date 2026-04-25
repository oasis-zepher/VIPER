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
import { getSessionId } from "src/bootstrap/state.js"
import { logForDebugging } from 'src/utils/debug.js'
import { type MatchedHook } from '../core.js'
import { getRegisteredHooks } from 'src/bootstrap/state.js'
import { getHooksConfigFromSnapshot, shouldAllowManagedHooksOnly } from 'src/utils/hooks/hooksConfigSnapshot.js'

export function hasWorktreeCreateHook(): boolean {
  const snapshotHooks = getHooksConfigFromSnapshot()?.['WorktreeCreate']
  if (snapshotHooks && snapshotHooks.length > 0) return true
  const registeredHooks = getRegisteredHooks()?.['WorktreeCreate']
  if (!registeredHooks || registeredHooks.length === 0) return false
  // Mirror getHooksConfig(): skip plugin hooks in managed-only mode
  const managedOnly = shouldAllowManagedHooksOnly()
  return registeredHooks.some(
    matcher => !(managedOnly && 'pluginRoot' in matcher),
  )
}

/**
 * Execute WorktreeCreate hooks.
 * Returns the worktree path from hook stdout.
 * Throws if hooks fail or produce no output.
 * Callers should check hasWorktreeCreateHook() before calling this.
 */
export async function executeWorktreeCreateHook(
  name: string,
): Promise<{ worktreePath: string }> {
  const hookInput = {
    ...createBaseHookInput(undefined),
    hook_event_name: 'WorktreeCreate' as const,
    name,
  }

  const results = await executeHooksOutsideREPL({
    hookInput,
    timeoutMs: TOOL_HOOK_EXECUTION_TIMEOUT_MS,
  })

  // Find the first successful result with non-empty output
  const successfulResult = results.find(
    r => r.succeeded && r.output.trim().length > 0,
  )

  if (!successfulResult) {
    const failedOutputs = results
      .filter(r => !r.succeeded)
      .map(r => `${r.command}: ${r.output.trim() || 'no output'}`)
    throw new Error(
      `WorktreeCreate hook failed: ${failedOutputs.join('; ') || 'no successful output'}`,
    )
  }

  const worktreePath = successfulResult.output.trim()
  return { worktreePath }
}

/**
 * Execute WorktreeRemove hooks if configured.
 * Returns true if hooks were configured and ran, false if no hooks are configured.
 *
 * Checks both settings-file hooks (getHooksConfigFromSnapshot) and registered
 * hooks (plugin hooks + SDK callback hooks via registerHookCallbacks).
 */
export async function executeWorktreeRemoveHook(
  worktreePath: string,
): Promise<boolean> {
  const snapshotHooks = getHooksConfigFromSnapshot()?.['WorktreeRemove']
  const registeredHooks = getRegisteredHooks()?.['WorktreeRemove']
  const hasSnapshotHooks = snapshotHooks && snapshotHooks.length > 0
  const hasRegisteredHooks = registeredHooks && registeredHooks.length > 0
  if (!hasSnapshotHooks && !hasRegisteredHooks) {
    return false
  }

  const hookInput = {
    ...createBaseHookInput(undefined),
    hook_event_name: 'WorktreeRemove' as const,
    worktree_path: worktreePath,
  }

  const results = await executeHooksOutsideREPL({
    hookInput,
    timeoutMs: TOOL_HOOK_EXECUTION_TIMEOUT_MS,
  })

  if (results.length === 0) {
    return false
  }

  for (const result of results) {
    if (!result.succeeded) {
      logForDebugging(
        `WorktreeRemove hook failed [${result.command}]: ${result.output.trim()}`,
        { level: 'error' },
      )
    }
  }

  return true
}

function getHookDefinitionsForTelemetry(
  matchedHooks: MatchedHook[],
): Array<{ type: string; command?: string; prompt?: string; name?: string }> {
  return matchedHooks.map(({ hook }) => {
    if (hook.type === 'command') {
      return { type: 'command', command: hook.command }
    } else if (hook.type === 'prompt') {
      return { type: 'prompt', prompt: hook.prompt }
    } else if (hook.type === 'http') {
      return { type: 'http', command: hook.url }
    } else if (hook.type === 'function') {
      return { type: 'function', name: 'function' }
    } else if (hook.type === 'callback') {
      return { type: 'callback', name: 'callback' }
    }
    return { type: 'unknown' }
  })
}
