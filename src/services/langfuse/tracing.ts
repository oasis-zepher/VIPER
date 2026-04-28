import { feature } from 'bun:bundle'

export type LangfuseSpan = {
  id?: string
  update?: (payload: Record<string, unknown>) => void
  end?: (endTime?: Date) => void
  otelSpan?: { spanContext(): unknown }
}

type TraceParams = {
  sessionId: string
  model: string
  provider: string
  input?: unknown
  name?: string
  querySource?: string
  username?: string
}

type LLMObservationParams = {
  model: string
  provider: string
  input: unknown
  output: unknown
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
  startTime?: Date
  endTime?: Date
  completionStartTime?: Date
  tools?: unknown
}

type ToolObservationParams = {
  toolName: string
  toolUseId: string
  input: unknown
  output: string
  startTime?: Date
  isError?: boolean
  parentBatchSpan?: LangfuseSpan | null
}

type ToolBatchSpanParams = {
  toolNames: string[]
  batchIndex: number
}

type SubagentTraceParams = {
  sessionId: string
  agentType: string
  agentId: string
  model: string
  provider: string
  input?: unknown
  username?: string
}

type ChildSpanParams = {
  name: string
  sessionId: string
  model: string
  provider: string
  input?: unknown
  querySource?: string
  username?: string
}

type TracingImpl = typeof import('./tracing.impl.js')

const impl: TracingImpl | null = feature('OBSERVABILITY')
  ? (require('./tracing.impl.js') as TracingImpl)
  : null

export function createTrace(params: TraceParams): LangfuseSpan | null {
  return (impl?.createTrace(params as never) as LangfuseSpan | null) ?? null
}

export function recordLLMObservation(
  rootSpan: LangfuseSpan | null,
  params: LLMObservationParams,
): void {
  impl?.recordLLMObservation(rootSpan as never, params as never)
}

export function recordToolObservation(
  rootSpan: LangfuseSpan | null,
  params: ToolObservationParams,
): void {
  impl?.recordToolObservation(rootSpan as never, params as never)
}

export function createToolBatchSpan(
  rootSpan: LangfuseSpan | null,
  params: ToolBatchSpanParams,
): LangfuseSpan | null {
  return (impl?.createToolBatchSpan(rootSpan as never, params) as
    | LangfuseSpan
    | null) ?? null
}

export function endToolBatchSpan(batchSpan: LangfuseSpan | null): void {
  impl?.endToolBatchSpan(batchSpan as never)
}

export function createSubagentTrace(
  params: SubagentTraceParams,
): LangfuseSpan | null {
  return (
    (impl?.createSubagentTrace(params as never) as LangfuseSpan | null) ?? null
  )
}

export function createChildSpan(
  parentSpan: LangfuseSpan | null,
  params: ChildSpanParams,
): LangfuseSpan | null {
  return (impl?.createChildSpan(parentSpan as never, params as never) as
    | LangfuseSpan
    | null) ?? null
}

export function endTrace(
  rootSpan: LangfuseSpan | null,
  output?: unknown,
  status?: 'interrupted' | 'error',
): void {
  impl?.endTrace(rootSpan as never, output, status)
}
