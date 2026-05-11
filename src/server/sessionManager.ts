/**
 * Server session manager — tracks active RCS bridge connections.
 *
 * Manages the lifecycle of connected remote-control sessions. Gated behind
 * BRIDGE_MODE; the stub class is never constructed when the feature is off.
 */
export const SessionManager: new (
  ..._args: unknown[]
) => {
  destroyAll(): Promise<void>
  [key: string]: unknown
} = class {
  async destroyAll() {}
} as never
