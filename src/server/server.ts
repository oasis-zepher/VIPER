/**
 * Self-hosted Remote Control Server entry point.
 *
 * Starts an HTTP server that hosts the web UI and bridges CLI sessions
 * to remote clients. Gated behind the BRIDGE_MODE feature flag.
 */
export const startServer: (
  ..._args: unknown[]
) => {
  port?: number
  stop: (_closeActiveConnections: boolean) => void
} = () => ({ stop() {} })
