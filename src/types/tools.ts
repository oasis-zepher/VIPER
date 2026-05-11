/**
 * Base union type for all tool progress payloads.
 *
 * Kept as a permissive base so code that accesses progress properties without
 * narrowing (common in the decompiled codebase) continues to type-check.
 * Individual tools should use the concrete progress types exported below.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolProgressData = any

// --- Concrete progress shapes (exported for tools that use them) ---

/** Progress yielded by BashTool's streaming shell-command generator. */
/** Progress yielded by BashTool's streaming shell-command generator. */
export interface BashProgress {
  type: string
  fullOutput: string
  output: string
  elapsedTimeSeconds: number
  totalLines: number
  totalBytes?: number
  taskId?: string
  timeoutMs?: number
}

/** Progress consumed by ShellProgressMessage for shell-mode display. */
export interface ShellProgress {
  type?: string
  fullOutput: string
  output: string
  elapsedTimeSeconds: number
  totalLines: number
  totalBytes?: number
  taskId?: string
  timeoutMs?: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PowerShellProgress = any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MCPProgress = any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type REPLToolProgress = any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SkillToolProgress = any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TaskOutputProgress = any

/**
 * Progress payload forwarded by AgentTool from sub-agent message streams.
 * Carries the inner message (assistant/user), optional prompt/agentId/taskId.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AgentToolProgress = any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WebSearchProgress = any

/** Delta batch of workflow state changes emitted by background agents. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SdkWorkflowProgress = any
