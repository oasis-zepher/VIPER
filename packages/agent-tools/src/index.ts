// agent-tools — Tool interface definitions and registry utilities
// Pure types + pure functions, zero runtime dependencies

export type {
  AnyObject,
  ToolInputJSONSchema,
  ToolProgressData,
  ToolProgress,
  ToolCallProgress,
  ToolResult,
  ValidationResult,
  PermissionResult,
  CoreTool,
  Tool,
  Tools,
  ToolDef,
} from './types.js'

export { buildTool, findToolByName, toolMatchesName } from './registry.js'
