/**
 * SSH session manager — manages lifecycle of an SSH-tunneled connection
 * to a remote Claude Code instance for teleport-style remote execution.
 */
import type { SDKMessage } from '../entrypoints/sdk/coreTypes.js'
import type { PermissionUpdate } from '../types/permissions.js'
import type { RemoteMessageContent } from '../utils/teleport/api.js'

export interface SSHSessionManagerOptions {
  onMessage: (_sdkMessage: SDKMessage) => void
  onPermissionRequest: (_request: SSHPermissionRequest, _requestId: string) => void
  onConnected: () => void
  onReconnecting: (_attempt: number, _max: number) => void
  onDisconnected: () => void
  onError: (_error: Error) => void
}

export interface SSHPermissionRequest {
  tool_name: string
  tool_use_id: string
  description?: string
  permission_suggestions?: PermissionUpdate[]
  blocked_path?: string
  input: { [key: string]: unknown }
}

export interface SSHSessionManager {
  connect(): void
  disconnect(): void
  sendMessage(_content: RemoteMessageContent): Promise<boolean>
  sendInterrupt(): void
  respondToPermissionRequest(
    _requestId: string,
    _response: { behavior: string; message?: string; updatedInput?: unknown },
  ): void
}
