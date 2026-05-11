/**
 * SSH session management for remote execution.
 *
 * Creates an SSH tunnel to a remote host and manages the session lifecycle.
 * Throws SSHSessionError in builds where SSH support is not compiled in.
 */
import type { Subprocess } from 'bun'
import type { SSHSessionManager, SSHSessionManagerOptions } from './SSHSessionManager.js'

export interface SSHAuthProxy {
  stop(): void
}

export interface SSHSession {
  remoteCwd: string
  proc: Subprocess
  proxy: SSHAuthProxy
  createManager(options: SSHSessionManagerOptions): SSHSessionManager
  getStderrTail(): string
}

export class SSHSessionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SSHSessionError'
  }
}

export const createSSHSession: (..._args: unknown[]) => Promise<SSHSession> = async () => {
  throw new SSHSessionError('SSH sessions are not supported in this build')
}

export const createLocalSSHSession: (..._args: unknown[]) => Promise<SSHSession> = async () => {
  throw new SSHSessionError('Local SSH sessions are not supported in this build')
}
