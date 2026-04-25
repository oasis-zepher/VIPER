/**
 * Named slice types for AppState.
 *
 * These interfaces document the logical groupings within the flat AppState
 * type. They are NOT used directly in AppState's definition (which remains
 * a single DeepImmutable<...> object) — instead they serve as:
 *
 *   1. Documentation of domain boundaries
 *   2. Utility types for functions that only need a subset of state
 *   3. Building blocks for future slice-based state architecture
 *
 * Zero runtime impact — types only.
 */

import type { Notification } from 'src/context/notifications.js'
import type { TodoList } from 'src/utils/todo/types.js'
import type { Command } from '../commands.js'
import type { ElicitationRequestEvent } from '../services/mcp/elicitationHandler.js'
import type {
  MCPServerConnection,
  ServerResource,
} from '../services/mcp/types.js'
import type { Tool, ToolPermissionContext } from '../Tool.js'
import type { TaskState } from '../tasks/types.js'
import type { AgentColorName } from '@claude-code-best/builtin-tools/tools/AgentTool/agentColorManager.js'
import type { AgentDefinitionsResult } from '@claude-code-best/builtin-tools/tools/AgentTool/loadAgentsDir.js'
import type { AgentId } from '../types/ids.js'
import type { LoadedPlugin, PluginError } from '../types/plugin.js'
import type { AttributionState } from '../utils/commitAttribution.js'
import type { FileHistoryState } from '../utils/fileHistory.js'
import type { SessionHooksState } from '../utils/hooks/sessionHooks.js'
import type { DenialTrackingState } from '../utils/permissions/denialTracking.js'
import type { SettingsJson } from '../utils/settings/types.js'
import type { ModelSetting } from '../utils/model/model.js'
import type { BridgePermissionCallbacks } from '../bridge/bridgePermissionCallbacks.js'
import type { ChannelPermissionCallbacks } from '../services/mcp/channelPermissions.js'

// ─── MCP ────────────────────────────────────────────────────────────────

export interface MCPSlice {
  mcp: {
    clients: MCPServerConnection[]
    tools: Tool[]
    commands: Command[]
    resources: Record<string, ServerResource[]>
    pluginReconnectKey: number
  }
}

// ─── Plugins ────────────────────────────────────────────────────────────

export interface PluginsSlice {
  plugins: {
    enabled: LoadedPlugin[]
    disabled: LoadedPlugin[]
    commands: Command[]
    errors: PluginError[]
    installationStatus: {
      marketplaces: Array<{
        name: string
        status: 'pending' | 'installing' | 'installed' | 'failed'
        error?: string
      }>
      plugins: Array<{
        id: string
        name: string
        status: 'pending' | 'installing' | 'installed' | 'failed'
        error?: string
      }>
    }
    needsRefresh: boolean
  }
}

// ─── Tasks ──────────────────────────────────────────────────────────────

export interface TasksSlice {
  tasks: { [taskId: string]: TaskState }
  todos: { [agentId: string]: TodoList }
}

// ─── Agents & Team ──────────────────────────────────────────────────────

export interface AgentsSlice {
  agentNameRegistry: Map<string, AgentId>
  agentDefinitions: AgentDefinitionsResult
  foregroundedTaskId?: string
  viewingAgentTaskId?: string
  teamContext?: {
    teamName: string
    teamFilePath: string
    leadAgentId: string
    selfAgentId?: string
    selfAgentName?: string
    isLeader?: boolean
    selfAgentColor?: string
    teammates: {
      [teammateId: string]: {
        name: string
        agentType?: string
        color?: string
        tmuxSessionName: string
        tmuxPaneId: string
        cwd: string
        worktreePath?: string
        spawnedAt: number
      }
    }
  }
  standaloneAgentContext?: {
    name: string
    color?: AgentColorName
  }
}

// ─── Bridge (Always-on Remote Control) ──────────────────────────────────

export interface BridgeSlice {
  replBridgeEnabled: boolean
  replBridgeExplicit: boolean
  replBridgeOutboundOnly: boolean
  replBridgeConnected: boolean
  replBridgeSessionActive: boolean
  replBridgeReconnecting: boolean
  replBridgeConnectUrl: string | undefined
  replBridgeSessionUrl: string | undefined
  replBridgeEnvironmentId: string | undefined
  replBridgeSessionId: string | undefined
  replBridgeError: string | undefined
  replBridgeInitialName: string | undefined
  showRemoteCallout: boolean
  replBridgePermissionCallbacks?: BridgePermissionCallbacks
  channelPermissionCallbacks?: ChannelPermissionCallbacks
}

// ─── Remote Session ─────────────────────────────────────────────────────

export interface RemoteSlice {
  remoteSessionUrl: string | undefined
  remoteConnectionStatus:
    | 'connecting'
    | 'connected'
    | 'reconnecting'
    | 'disconnected'
  remoteBackgroundTaskCount: number
  remoteAgentTaskSuggestions: { summary: string; task: string }[]
}

// ─── Notifications & Elicitation ────────────────────────────────────────

export interface NotificationsSlice {
  notifications: {
    current: Notification | null
    queue: Notification[]
  }
  elicitation: {
    queue: ElicitationRequestEvent[]
  }
}

// ─── Prompt Suggestion & Speculation ────────────────────────────────────

import type { SpeculationState } from './AppStateStore.js'

export interface PromptSuggestionSlice {
  promptSuggestion: {
    text: string | null
    promptId: 'user_intent' | 'stated_intent' | null
    shownAt: number
    acceptedAt: number
    generationRequestId: string | null
  }
  promptSuggestionEnabled: boolean
  speculation: SpeculationState
  speculationSessionTimeSavedMs: number
}

// ─── Worker Sandbox ─────────────────────────────────────────────────────

export interface WorkerSlice {
  workerSandboxPermissions: {
    queue: Array<{
      requestId: string
      workerId: string
      workerName: string
      workerColor?: string
      host: string
      createdAt: number
    }>
    selectedIndex: number
  }
  pendingWorkerRequest: {
    toolName: string
    toolUseId: string
    description: string
  } | null
  pendingSandboxRequest: {
    requestId: string
    host: string
  } | null
}

// ─── Ultraplan ──────────────────────────────────────────────────────────

export interface UltraplanSlice {
  ultraplanLaunching?: boolean
  ultraplanSessionUrl?: string
  ultraplanPendingChoice?: { plan: string; sessionId: string; taskId: string }
  ultraplanLaunchPending?: { blurb: string }
  isUltraplanMode?: boolean
}

// ─── Tmux (Tungsten) ────────────────────────────────────────────────────

export interface TungstenSlice {
  tungstenActiveSession?: {
    sessionName: string
    socketName: string
    target: string
  }
  tungstenLastCapturedTime?: number
  tungstenLastCommand?: {
    command: string
    timestamp: number
  }
  tungstenPanelVisible?: boolean
  tungstenPanelAutoHidden?: boolean
}

// ─── Web Browser (Bagel) ────────────────────────────────────────────────

export interface BagelSlice {
  bagelActive?: boolean
  bagelUrl?: string
  bagelPanelVisible?: boolean
}
