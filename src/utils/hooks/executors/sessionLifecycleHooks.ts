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
import type { SessionStartHookInput, SetupHookInput, SubagentStartHookInput } from "src/entrypoints/agentSdkTypes.js"
import type { ToolUseContext } from 'src/Tool.js'
import type { Message } from "src/types/message.js"
import type { PromptRequest, PromptResponse } from "src/types/hooks.js"
import { randomUUID } from 'crypto'

export async function* executeSessionStartHooks(
  source: 'startup' | 'resume' | 'clear' | 'compact',
  sessionId?: string,
  agentType?: string,
  model?: string,
  signal?: AbortSignal,
  timeoutMs: number = TOOL_HOOK_EXECUTION_TIMEOUT_MS,
  forceSyncExecution?: boolean,
): AsyncGenerator<AggregatedHookResult> {
  const hookInput: SessionStartHookInput = {
    ...createBaseHookInput(undefined, sessionId),
    hook_event_name: 'SessionStart',
    source,
    agent_type: agentType,
    model,
  }

  yield* executeHooks({
    hookInput,
    toolUseID: randomUUID(),
    matchQuery: source,
    signal,
    timeoutMs,
    forceSyncExecution,
  })
}

/**
 * Execute setup hooks if configured
 * @param trigger The trigger type ('init' or 'maintenance')
 * @param signal Optional AbortSignal to cancel hook execution
 * @param timeoutMs Optional timeout in milliseconds for hook execution
 * @param forceSyncExecution If true, async hooks will not be backgrounded
 * @returns Async generator that yields progress messages and hook results
 */
export async function* executeSetupHooks(
  trigger: 'init' | 'maintenance',
  signal?: AbortSignal,
  timeoutMs: number = TOOL_HOOK_EXECUTION_TIMEOUT_MS,
  forceSyncExecution?: boolean,
): AsyncGenerator<AggregatedHookResult> {
  const hookInput: SetupHookInput = {
    ...createBaseHookInput(undefined),
    hook_event_name: 'Setup',
    trigger,
  }

  yield* executeHooks({
    hookInput,
    toolUseID: randomUUID(),
    matchQuery: trigger,
    signal,
    timeoutMs,
    forceSyncExecution,
  })
}

/**
 * Execute subagent start hooks if configured
 * @param agentId The unique identifier for the subagent
 * @param agentType The type/name of the subagent being started
 * @param signal Optional AbortSignal to cancel hook execution
 * @param timeoutMs Optional timeout in milliseconds for hook execution
 * @returns Async generator that yields progress messages and hook results
 */
export async function* executeSubagentStartHooks(
  agentId: string,
  agentType: string,
  signal?: AbortSignal,
  timeoutMs: number = TOOL_HOOK_EXECUTION_TIMEOUT_MS,
): AsyncGenerator<AggregatedHookResult> {
  const hookInput: SubagentStartHookInput = {
    ...createBaseHookInput(undefined),
    hook_event_name: 'SubagentStart',
    agent_id: agentId,
    agent_type: agentType,
  }

  yield* executeHooks({
    hookInput,
    toolUseID: randomUUID(),
    matchQuery: agentType,
    signal,
    timeoutMs,
  })
}

/**
 * Execute pre-compact hooks if configured
 * @param compactData The compact data to pass to hooks
 * @param signal Optional AbortSignal to cancel hook execution
 * @param timeoutMs Optional timeout in milliseconds for hook execution
 * @returns Object with optional newCustomInstructions and userDisplayMessage
 */
