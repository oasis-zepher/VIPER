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
import type { PreCompactHookInput, PostCompactHookInput } from "src/entrypoints/agentSdkTypes.js"
import type { ToolUseContext } from 'src/Tool.js'
import type { Message } from "src/types/message.js"
import { getSessionId } from "src/bootstrap/state.js"
import { logForDebugging } from 'src/utils/debug.js'
import { type ExitReason, type SessionEndHookInput } from 'src/entrypoints/agentSdkTypes.js'
import { type AppState } from 'src/state/AppState.js'
import { clearSessionHooks } from 'src/utils/hooks/sessionHooks.js'

export async function executePreCompactHooks(
  compactData: {
    trigger: 'manual' | 'auto'
    customInstructions: string | null
  },
  signal?: AbortSignal,
  timeoutMs: number = TOOL_HOOK_EXECUTION_TIMEOUT_MS,
): Promise<{
  newCustomInstructions?: string
  userDisplayMessage?: string
}> {
  const hookInput: PreCompactHookInput = {
    ...createBaseHookInput(undefined),
    hook_event_name: 'PreCompact',
    trigger: compactData.trigger,
    custom_instructions: compactData.customInstructions,
  }

  const results = await executeHooksOutsideREPL({
    hookInput,
    matchQuery: compactData.trigger,
    signal,
    timeoutMs,
  })

  if (results.length === 0) {
    return {}
  }

  // Extract custom instructions from successful hooks with non-empty output
  const successfulOutputs = results
    .filter(result => result.succeeded && result.output.trim().length > 0)
    .map(result => result.output.trim())

  // Build user display messages with command info
  const displayMessages: string[] = []
  for (const result of results) {
    if (result.succeeded) {
      if (result.output.trim()) {
        displayMessages.push(
          `PreCompact [${result.command}] completed successfully: ${result.output.trim()}`,
        )
      } else {
        displayMessages.push(
          `PreCompact [${result.command}] completed successfully`,
        )
      }
    } else {
      if (result.output.trim()) {
        displayMessages.push(
          `PreCompact [${result.command}] failed: ${result.output.trim()}`,
        )
      } else {
        displayMessages.push(`PreCompact [${result.command}] failed`)
      }
    }
  }

  return {
    newCustomInstructions:
      successfulOutputs.length > 0 ? successfulOutputs.join('\n\n') : undefined,
    userDisplayMessage:
      displayMessages.length > 0 ? displayMessages.join('\n') : undefined,
  }
}

/**
 * Execute post-compact hooks if configured
 * @param compactData The compact data to pass to hooks, including the summary
 * @param signal Optional AbortSignal to cancel hook execution
 * @param timeoutMs Optional timeout in milliseconds for hook execution
 * @returns Object with optional userDisplayMessage
 */
export async function executePostCompactHooks(
  compactData: {
    trigger: 'manual' | 'auto'
    compactSummary: string
  },
  signal?: AbortSignal,
  timeoutMs: number = TOOL_HOOK_EXECUTION_TIMEOUT_MS,
): Promise<{
  userDisplayMessage?: string
}> {
  const hookInput: PostCompactHookInput = {
    ...createBaseHookInput(undefined),
    hook_event_name: 'PostCompact',
    trigger: compactData.trigger,
    compact_summary: compactData.compactSummary,
  }

  const results = await executeHooksOutsideREPL({
    hookInput,
    matchQuery: compactData.trigger,
    signal,
    timeoutMs,
  })

  if (results.length === 0) {
    return {}
  }

  const displayMessages: string[] = []
  for (const result of results) {
    if (result.succeeded) {
      if (result.output.trim()) {
        displayMessages.push(
          `PostCompact [${result.command}] completed successfully: ${result.output.trim()}`,
        )
      } else {
        displayMessages.push(
          `PostCompact [${result.command}] completed successfully`,
        )
      }
    } else {
      if (result.output.trim()) {
        displayMessages.push(
          `PostCompact [${result.command}] failed: ${result.output.trim()}`,
        )
      } else {
        displayMessages.push(`PostCompact [${result.command}] failed`)
      }
    }
  }

  return {
    userDisplayMessage:
      displayMessages.length > 0 ? displayMessages.join('\n') : undefined,
  }
}

/**
 * Execute session end hooks if configured
 * @param reason The reason for ending the session
 * @param options Optional parameters including app state functions and signal
 * @returns Promise that resolves when all hooks complete
 */
export async function executeSessionEndHooks(
  reason: ExitReason,
  options?: {
    getAppState?: () => AppState
    setAppState?: (updater: (prev: AppState) => AppState) => void
    signal?: AbortSignal
    timeoutMs?: number
  },
): Promise<void> {
  const {
    getAppState,
    setAppState,
    signal,
    timeoutMs = TOOL_HOOK_EXECUTION_TIMEOUT_MS,
  } = options || {}

  const hookInput = {
    ...createBaseHookInput(undefined),
    hook_event_name: 'SessionEnd' as const,
    reason,
  } as unknown as SessionEndHookInput

  const results = await executeHooksOutsideREPL({
    getAppState,
    hookInput,
    matchQuery: reason,
    signal,
    timeoutMs,
  })

  // During shutdown, Ink is unmounted so we can write directly to stderr
  for (const result of results) {
    if (!result.succeeded && result.output) {
      process.stderr.write(
        `SessionEnd hook [${result.command}] failed: ${result.output}\n`,
      )
    }
  }

  // Clear session hooks after execution
  if (setAppState) {
    const sessionId = getSessionId()
    clearSessionHooks(setAppState, sessionId)
  }
}

/**
 * Execute permission request hooks if configured
 * These hooks are called when a permission dialog would be displayed to the user.
 * Hooks can approve or deny the permission request programmatically.
 * @param toolName The name of the tool requesting permission
 * @param toolUseID The ID of the tool use
 * @param toolInput The input that would be passed to the tool
 * @param toolUseContext ToolUseContext for the request
 * @param permissionMode Optional permission mode from toolPermissionContext
 * @param permissionSuggestions Optional permission suggestions (the "always allow" options)
 * @param signal Optional AbortSignal to cancel hook execution
 * @param timeoutMs Optional timeout in milliseconds for hook execution
 * @returns Async generator that yields progress messages and returns aggregated result
 */
