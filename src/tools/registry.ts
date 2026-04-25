import type { Tool, Tools } from '../Tool.js'

/**
 * A pluggable tool registry that replaces the hardcoded array in getAllBaseTools().
 *
 * Tools can be registered as:
 * - Always-on: `registry.register(tool)`
 * - Conditional: `registry.registerConditional(tool, () => condition)`
 * - Lazy (deferred require): `registry.registerLazy(() => require(...).Tool, () => condition)`
 */
export class ToolRegistry {
  private entries: Array<{
    tool: Tool | (() => Tool | null)
    condition?: () => boolean
  }> = []

  /** Register a tool that is always available. */
  register(tool: Tool): void {
    this.entries.push({ tool })
  }

  /** Register a tool that is available only when condition returns true. */
  registerConditional(tool: Tool, condition: () => boolean): void {
    this.entries.push({ tool, condition })
  }

  /**
   * Register a lazy-loaded tool. The factory is called at most once per
   * `getAvailableTools()` invocation, and only when the condition (if any) is true.
   */
  registerLazy(factory: () => Tool | null, condition?: () => boolean): void {
    this.entries.push({ tool: factory, condition })
  }

  /** Return all tools whose condition is satisfied. */
  getAvailableTools(): Tools {
    const result: Tool[] = []
    for (const entry of this.entries) {
      if (entry.condition && !entry.condition()) continue
      const tool = typeof entry.tool === 'function' ? entry.tool() : entry.tool
      if (tool) result.push(tool)
    }
    return result
  }
}
