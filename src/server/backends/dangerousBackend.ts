/**
 * Dangerous (no-auth) backend for local-only RCS connections.
 *
 * Accepts connections without authentication — intended for development
 * and single-user deployments. Not used in production bridge mode.
 */
export const DangerousBackend: new (
  ..._args: unknown[]
) => Record<string, unknown> = class {} as never
