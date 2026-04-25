export { ToolRegistry } from './registry.js'
import { ToolRegistry } from './registry.js'
import { registerBuiltinTools } from './builtinRegistrations.js'

/**
 * Lazy singleton tool registry. Not populated at import time to avoid
 * circular-dependency TDZ errors (builtinRegistrations imports tools that
 * transitively import src/tools.ts).
 */
let _singleton: ToolRegistry | null = null
export function getToolRegistry(): ToolRegistry {
  if (!_singleton) {
    _singleton = new ToolRegistry()
    registerBuiltinTools(_singleton)
  }
  return _singleton
}

// Re-export all public functions and types from builtinRegistrations
// so consumers can import from 'src/tools/index.js' or 'src/tools.js'
export {
  getAllBaseTools,
  getTools,
  assembleToolPool,
  getMergedTools,
  filterToolsByDenyRules,
  getToolsForDefaultPreset,
  parseToolPreset,
  TOOL_PRESETS,
  type ToolPreset,
} from './builtinRegistrations.js'

export {
  ALL_AGENT_DISALLOWED_TOOLS,
  CUSTOM_AGENT_DISALLOWED_TOOLS,
  ASYNC_AGENT_ALLOWED_TOOLS,
  COORDINATOR_MODE_ALLOWED_TOOLS,
} from './builtinRegistrations.js'

export { REPL_ONLY_TOOLS } from './builtinRegistrations.js'
