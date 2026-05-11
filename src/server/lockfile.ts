/**
 * Server lock-file management for the self-hosted Remote Control Server.
 *
 * The lock file tracks the running server's PID, port, host, and HTTP URL
 * so that CLI consumers can discover and connect to it.
 */
export interface ServerLockInfo {
  pid: number
  port: number
  host: string
  httpUrl: string
  startedAt: number
}

export const writeServerLock: (_info: ServerLockInfo) => Promise<void> = async () => {}

export const removeServerLock: () => Promise<void> = async () => {}

/** Probe for a running server by reading the lock file. Returns null when no server is found. */
export const probeRunningServer: () => Promise<ServerLockInfo | null> = async () => null
