export const KNOWN_QUERY_SOURCES = [
  'agent_creation',
  'agent_summary',
  'auto_dream',
  'auto_mode',
  'auto_mode_critique',
  'away_summary',
  'bash_classifier',
  'bash_extract_prefix',
  'chrome_mcp',
  'compact',
  'extract_memories',
  'feedback',
  'generate_session_title',
  'hook_agent',
  'hook_prompt',
  'insights',
  'magic_docs',
  'marble_origami',
  'mcp_datetime_parse',
  'memdir_relevance',
  'model_validation',
  'permission_explainer',
  'prompt_suggestion',
  'rename_generate_name',
  'repl_main_thread',
  'sdk',
  'session_memory',
  'session_search',
  'side_question',
  'skill_improvement',
  'skill_improvement_apply',
  'speculation',
  'teleport_generate_title',
  'tool_use_summary_generation',
  'user',
  'verification_agent',
  'web_fetch_apply',
  'web_search_tool',
] as const

export type KnownQuerySource = (typeof KNOWN_QUERY_SOURCES)[number]
export type AgentQuerySource =
  | 'agent:custom'
  | 'agent:default'
  | 'agent:builtin'
  | `agent:builtin:${string}`
export type ReplMainThreadQuerySource =
  | 'repl_main_thread'
  | `repl_main_thread:outputStyle:${string}`

export type QuerySource =
  | KnownQuerySource
  | AgentQuerySource
  | ReplMainThreadQuerySource

export type QuerySourceCacheDomain =
  | 'main'
  | 'sdk'
  | 'agent'
  | 'compact'
  | 'hook'
  | 'classifier'
  | 'side-query'
  | 'tool-aux'
  | 'validation'
  | 'unknown'

const CLASSIFIER_SOURCES = new Set<string>([
  'auto_mode',
  'auto_mode_critique',
  'bash_classifier',
  'bash_extract_prefix',
  'permission_explainer',
])

const SIDE_QUERY_SOURCES = new Set<string>([
  'agent_creation',
  'chrome_mcp',
  'feedback',
  'generate_session_title',
  'insights',
  'magic_docs',
  'mcp_datetime_parse',
  'memdir_relevance',
  'prompt_suggestion',
  'rename_generate_name',
  'session_search',
  'side_question',
  'speculation',
  'teleport_generate_title',
  'web_fetch_apply',
  'web_search_tool',
])

const TOOL_AUX_SOURCES = new Set<string>([
  'agent_summary',
  'auto_dream',
  'away_summary',
  'extract_memories',
  'session_memory',
  'skill_improvement_apply',
  'tool_use_summary_generation',
])

const VALIDATION_SOURCES = new Set<string>([
  'model_validation',
  'verification_agent',
])

export function getQuerySourceCacheDomain(
  querySource: QuerySource | string | undefined,
): QuerySourceCacheDomain {
  if (!querySource) return 'unknown'
  if (querySource.startsWith('repl_main_thread')) return 'main'
  if (querySource === 'sdk') return 'sdk'
  if (querySource.startsWith('agent:') || querySource === 'marble_origami') {
    return 'agent'
  }
  if (querySource === 'compact') return 'compact'
  if (querySource === 'hook_agent' || querySource === 'hook_prompt') {
    return 'hook'
  }
  if (CLASSIFIER_SOURCES.has(querySource)) return 'classifier'
  if (SIDE_QUERY_SOURCES.has(querySource)) return 'side-query'
  if (TOOL_AUX_SOURCES.has(querySource)) return 'tool-aux'
  if (VALIDATION_SOURCES.has(querySource)) return 'validation'
  return 'unknown'
}

export function isOneShotQuerySource(
  querySource: QuerySource | string | undefined,
): boolean {
  const domain = getQuerySourceCacheDomain(querySource)
  return (
    domain === 'classifier' ||
    domain === 'side-query' ||
    domain === 'tool-aux' ||
    domain === 'validation'
  )
}

export function getPromptCacheTrackingKey(
  querySource: QuerySource | string,
  agentId?: string,
): string | null {
  const domain = getQuerySourceCacheDomain(querySource)
  switch (domain) {
    case 'main':
      return querySource
    case 'sdk':
      return 'sdk'
    case 'compact':
      return 'repl_main_thread'
    case 'agent':
      return agentId || querySource
    case 'hook':
      return querySource
    default:
      return null
  }
}
