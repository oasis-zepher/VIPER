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
import type { ConfigChangeHookInput, CwdChangedHookInput, FileChangedHookInput } from "src/entrypoints/agentSdkTypes.js"
import { type HookInput } from 'src/entrypoints/agentSdkTypes.js'

export type ConfigChangeSource =
  | 'user_settings'
  | 'project_settings'
  | 'local_settings'
  | 'policy_settings'
  | 'skills'
import { invalidateSessionEnvCache } from 'src/utils/sessionEnvironment.js'

export async function executeConfigChangeHooks(
  source: ConfigChangeSource,
  filePath?: string,
  timeoutMs: number = TOOL_HOOK_EXECUTION_TIMEOUT_MS,
): Promise<HookOutsideReplResult[]> {
  const hookInput: ConfigChangeHookInput = {
    ...createBaseHookInput(undefined),
    hook_event_name: 'ConfigChange',
    source,
    file_path: filePath,
  }

  const results = await executeHooksOutsideREPL({
    hookInput,
    timeoutMs,
    matchQuery: source,
  })

  // Policy settings are enterprise-managed — hooks fire for audit logging
  // but must never block policy changes from being applied
  if (source === 'policy_settings') {
    return results.map(r => ({ ...r, blocked: false }))
  }

  return results
}

async function executeEnvHooks(
  hookInput: HookInput,
  timeoutMs: number,
): Promise<{
  results: HookOutsideReplResult[]
  watchPaths: string[]
  systemMessages: string[]
}> {
  const results = await executeHooksOutsideREPL({ hookInput, timeoutMs })
  if (results.length > 0) {
    invalidateSessionEnvCache()
  }
  const watchPaths = results.flatMap(r => r.watchPaths ?? [])
  const systemMessages = results
    .map(r => r.systemMessage)
    .filter((m): m is string => !!m)
  return { results, watchPaths, systemMessages }
}

export function executeCwdChangedHooks(
  oldCwd: string,
  newCwd: string,
  timeoutMs: number = TOOL_HOOK_EXECUTION_TIMEOUT_MS,
): Promise<{
  results: HookOutsideReplResult[]
  watchPaths: string[]
  systemMessages: string[]
}> {
  const hookInput: CwdChangedHookInput = {
    ...createBaseHookInput(undefined),
    hook_event_name: 'CwdChanged',
    old_cwd: oldCwd,
    new_cwd: newCwd,
  }
  return executeEnvHooks(hookInput, timeoutMs)
}

export function executeFileChangedHooks(
  filePath: string,
  event: 'change' | 'add' | 'unlink',
  timeoutMs: number = TOOL_HOOK_EXECUTION_TIMEOUT_MS,
): Promise<{
  results: HookOutsideReplResult[]
  watchPaths: string[]
  systemMessages: string[]
}> {
  const hookInput = {
    ...createBaseHookInput(undefined),
    hook_event_name: 'FileChanged' as const,
    file_path: filePath,
    event,
  } as unknown as FileChangedHookInput
  return executeEnvHooks(hookInput, timeoutMs)
}

