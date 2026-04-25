/**
 * Headless (non-interactive / print) mode execution path.
 * Extracted from main.tsx action handler to reduce its size.
 */

import { feature } from 'bun:bundle'
import uniqBy from 'lodash-es/uniqBy.js'
import pickBy from 'lodash-es/pickBy.js'
import type { Root } from '@anthropic/ink'
import type { AppState } from '../state/AppStateStore.js'
import { getDefaultAppState } from '../state/AppStateStore.js'
import { createStore } from '../state/store.js'
import { onChangeAppState } from '../state/onChangeAppState.js'
import type { ScopedMcpServerConfig, McpSdkServerConfig, MCPServerConnection } from '../services/mcp/types.js'
import type { ThinkingConfig } from '../utils/thinking.js'
import type { ToolPermissionContext, Tools, Tool } from '../Tool.js'
import type { Command } from '../types/command.js'
import type { AgentDefinition } from '@claude-code-best/builtin-tools/tools/AgentTool/loadAgentsDir.js'
import { setHasFormattedOutput, logForDebugging } from '../utils/debug.js'
import { applyConfigEnvironmentVariables } from '../utils/managedEnv.js'
import { initializeTelemetryAfterTrust } from '../entrypoints/init.js'
import { processSessionStartHooks } from '../utils/sessionStart.js'
import { validateForceLoginOrg } from '../utils/auth.js'
import { verifyAutoModeGateAccess } from '../utils/permissions/permissionSetup.js'
import { setSessionPersistenceDisabled, setSdkBetas } from '../bootstrap/state.js'
import { filterAllowedSdkBetas } from '../utils/betas.js'
import { getMcpToolsCommandsAndResources, clearServerCache } from '../services/mcp/client.js'
import { getMcpServerSignature, dedupClaudeAiMcpServers } from '../services/mcp/config.js'
import { excludeCommandsByServer, excludeResourcesByServer } from '../services/mcp/utils.js'
import { isBareMode } from '../utils/envUtils.js'
import { profileCheckpoint } from '../utils/startupProfiler.js'
import { parseEffortValue, getInitialEffortSetting } from '../utils/effort.js'
import { isFastModeEnabled, getInitialFastModeSetting } from '../utils/fastMode.js'
import { isAdvisorEnabled } from '../utils/advisor.js'

export interface HeadlessParams {
  root: Root
  outputFormat: string | undefined
  options: {
    continue?: boolean | undefined
    resume?: string | boolean | undefined
    sessionPersistence?: boolean | undefined
    effort?: string | undefined
    permissionPromptTool?: string | undefined
    maxTurns?: number | undefined
    maxBudgetUsd?: number | undefined
    taskBudget?: number | undefined
    forkSession?: boolean | undefined
    resumeSessionAt?: string | undefined
    rewindFiles?: string | undefined
    enableAuthStatus?: boolean | undefined
    workload?: string | undefined
  }
  teleport: string | true | null
  setupTrigger: 'init' | 'maintenance' | null
  disableSlashCommands: boolean
  commands: Command[]
  toolPermissionContext: ToolPermissionContext
  mcpClients: MCPServerConnection[]
  mcpTools: Tool[]
  mcpCommands: Command[]
  betas: string[]
  effectiveModel: string | undefined
  advisorModel: string | undefined
  kairosEnabled: boolean
  regularMcpConfigs: Record<string, ScopedMcpServerConfig>
  claudeaiConfigPromise: Promise<Record<string, ScopedMcpServerConfig>>
  inputPrompt: string | AsyncIterable<string>
  allowedTools: string[] | undefined
  systemPrompt: string | undefined
  appendSystemPrompt: string | undefined
  sdkMcpConfigs: Record<string, McpSdkServerConfig>
  agentDefinitions: { activeAgents: AgentDefinition[] }
  jsonSchema: Record<string, unknown> | undefined
  verbose: boolean | undefined
  debug: boolean
  debugToStderr: boolean
  thinkingConfig: ThinkingConfig
  tools: Tools
  userSpecifiedFallbackModel: string | undefined
  sdkUrl: string | undefined
  effectiveReplayUserMessages: boolean | undefined
  effectiveIncludePartialMessages: boolean | undefined
  agentCli: string | undefined
  logSessionTelemetry: () => void
  startDeferredPrefetches: () => void
}

/**
 * Run headless (non-interactive / print) mode.
 * This is the `if (isNonInteractiveSession)` branch from main.tsx action handler.
 */
export async function runHeadlessMode(params: HeadlessParams): Promise<void> {
  const {
    root,
    outputFormat,
    options,
    teleport,
    setupTrigger,
    disableSlashCommands,
    commands,
    toolPermissionContext,
    mcpClients,
    mcpTools,
    mcpCommands,
    betas,
    effectiveModel,
    advisorModel,
    kairosEnabled,
    regularMcpConfigs,
    claudeaiConfigPromise,
    inputPrompt,
    allowedTools,
    systemPrompt,
    appendSystemPrompt,
    sdkMcpConfigs,
    agentDefinitions,
    jsonSchema,
    verbose,
    debug,
    debugToStderr,
    thinkingConfig,
    tools,
    userSpecifiedFallbackModel,
    sdkUrl,
    effectiveReplayUserMessages,
    effectiveIncludePartialMessages,
    agentCli,
    logSessionTelemetry,
    startDeferredPrefetches,
  } = params

  if (outputFormat === 'stream-json' || outputFormat === 'json') {
    setHasFormattedOutput(true)
  }

  // Apply full environment variables in print mode since trust dialog is bypassed
  applyConfigEnvironmentVariables()

  // Initialize telemetry after env vars are applied so OTEL endpoint env vars and
  // otelHeadersHelper (which requires trust to execute) are available.
  initializeTelemetryAfterTrust()

  // Kick SessionStart hooks now so the subprocess spawn overlaps with
  // MCP connect + plugin init + print.ts import below.
  const sessionStartHooksPromise =
    options.continue ||
    options.resume ||
    teleport ||
    setupTrigger
      ? undefined
      : processSessionStartHooks('startup')
  sessionStartHooksPromise?.catch(() => {})

  profileCheckpoint('before_validateForceLoginOrg')
  const orgValidation = await validateForceLoginOrg()
  if (!orgValidation.valid) {
    process.stderr.write((orgValidation as { valid: false; message: string }).message + '\n')
    process.exit(1)
  }

  // Headless mode supports all prompt commands and some local commands
  const commandsHeadless = disableSlashCommands
    ? []
    : commands.filter(
        (command) =>
          (command.type === 'prompt' && !command.disableNonInteractive) ||
          (command.type === 'local' && command.supportsNonInteractive),
      )

  const defaultState = getDefaultAppState()
  const headlessInitialState: AppState = {
    ...defaultState,
    mcp: {
      ...defaultState.mcp,
      clients: mcpClients,
      commands: mcpCommands,
      tools: mcpTools,
    },
    toolPermissionContext,
    effortValue: parseEffortValue(options.effort) ?? getInitialEffortSetting(),
    ...(isFastModeEnabled() && {
      fastMode: getInitialFastModeSetting(effectiveModel ?? null),
    }),
    ...(isAdvisorEnabled() && advisorModel && { advisorModel }),
    ...(feature('KAIROS') ? { kairosEnabled } : {}),
  }

  // Init app state
  const headlessStore = createStore(headlessInitialState, onChangeAppState)

  // Async check of auto mode gate
  if (feature('TRANSCRIPT_CLASSIFIER')) {
    void verifyAutoModeGateAccess(
      toolPermissionContext,
      headlessStore.getState().fastMode,
    ).then(({ updateContext }) => {
      headlessStore.setState((prev) => {
        const nextCtx = updateContext(prev.toolPermissionContext)
        if (nextCtx === prev.toolPermissionContext) return prev
        return { ...prev, toolPermissionContext: nextCtx }
      })
    })
  }

  // Set global state for session persistence
  if (options.sessionPersistence === false) {
    setSessionPersistenceDisabled(true)
  }

  // Store SDK betas in global state for context window calculation
  setSdkBetas(filterAllowedSdkBetas(betas))

  // Print-mode MCP: per-server incremental push into headlessStore.
  const connectMcpBatch = (
    configs: Record<string, ScopedMcpServerConfig>,
    label: string,
  ): Promise<void> => {
    if (Object.keys(configs).length === 0) return Promise.resolve()
    headlessStore.setState((prev) => ({
      ...prev,
      mcp: {
        ...prev.mcp,
        clients: [
          ...prev.mcp.clients,
          ...Object.entries(configs).map(([name, config]) => ({
            name,
            type: 'pending' as const,
            config,
          })),
        ],
      },
    }))
    return getMcpToolsCommandsAndResources(
      ({ client, tools: newTools, commands: newCommands }) => {
        headlessStore.setState((prev) => ({
          ...prev,
          mcp: {
            ...prev.mcp,
            clients: prev.mcp.clients.some((c) => c.name === client.name)
              ? prev.mcp.clients.map((c) => (c.name === client.name ? client : c))
              : [...prev.mcp.clients, client],
            tools: uniqBy([...prev.mcp.tools, ...newTools], 'name'),
            commands: uniqBy([...prev.mcp.commands, ...newCommands], 'name'),
          },
        }))
      },
      configs,
    ).catch((err) => logForDebugging(`[MCP] ${label} connect error: ${err}`))
  }

  // Await all MCP configs — print mode is often single-turn
  profileCheckpoint('before_connectMcp')
  await connectMcpBatch(regularMcpConfigs, 'regular')
  profileCheckpoint('after_connectMcp')

  // Dedup: suppress plugin MCP servers that duplicate a claude.ai connector
  const CLAUDE_AI_MCP_TIMEOUT_MS = 5_000
  const claudeaiConnect = claudeaiConfigPromise.then((claudeaiConfigs) => {
    if (Object.keys(claudeaiConfigs).length > 0) {
      const claudeaiSigs = new Set<string>()
      for (const config of Object.values(claudeaiConfigs)) {
        const sig = getMcpServerSignature(config)
        if (sig) claudeaiSigs.add(sig)
      }
      const suppressed = new Set<string>()
      for (const [name, config] of Object.entries(regularMcpConfigs)) {
        if (!name.startsWith('plugin:')) continue
        const sig = getMcpServerSignature(config)
        if (sig && claudeaiSigs.has(sig)) suppressed.add(name)
      }
      if (suppressed.size > 0) {
        logForDebugging(
          `[MCP] Lazy dedup: suppressing ${suppressed.size} plugin server(s) that duplicate claude.ai connectors: ${[...suppressed].join(', ')}`,
        )
        for (const c of headlessStore.getState().mcp.clients) {
          if (!suppressed.has(c.name) || c.type !== 'connected') continue
          c.client.onclose = undefined
          void clearServerCache(c.name, c.config).catch(() => {})
        }
        headlessStore.setState((prev) => {
          let { clients, tools: prevTools, commands: prevCommands, resources } = prev.mcp
          clients = clients.filter((c) => !suppressed.has(c.name))
          prevTools = prevTools.filter(
            (t) => !t.mcpInfo || !suppressed.has(t.mcpInfo.serverName),
          )
          for (const name of suppressed) {
            prevCommands = excludeCommandsByServer(prevCommands, name)
            resources = excludeResourcesByServer(resources, name)
          }
          return {
            ...prev,
            mcp: { ...prev.mcp, clients, tools: prevTools, commands: prevCommands, resources },
          }
        })
      }
    }
    // Suppress claude.ai connectors that duplicate an enabled manual server
    const nonPluginConfigs = pickBy(regularMcpConfigs, (_, n) => !n.startsWith('plugin:'))
    const { servers: dedupedClaudeAi } = dedupClaudeAiMcpServers(claudeaiConfigs, nonPluginConfigs)
    return connectMcpBatch(dedupedClaudeAi, 'claudeai')
  })

  let claudeaiTimer: ReturnType<typeof setTimeout> | undefined
  const claudeaiTimedOut = await Promise.race([
    claudeaiConnect.then(() => false),
    new Promise<boolean>((resolve) => {
      claudeaiTimer = setTimeout((r) => r(true), CLAUDE_AI_MCP_TIMEOUT_MS, resolve)
    }),
  ])
  if (claudeaiTimer) clearTimeout(claudeaiTimer)
  if (claudeaiTimedOut) {
    logForDebugging(
      `[MCP] claude.ai connectors not ready after ${CLAUDE_AI_MCP_TIMEOUT_MS}ms — proceeding; background connection continues`,
    )
  }
  profileCheckpoint('after_connectMcp_claudeai')

  // In headless mode, start deferred prefetches immediately
  if (!isBareMode()) {
    startDeferredPrefetches()
    void import('../utils/backgroundHousekeeping.js').then((m) => m.startBackgroundHousekeeping())
    if (process.env.USER_TYPE === 'ant') {
      void import('../utils/sdkHeapDumpMonitor.js').then((m) => m.startSdkMemoryMonitor())
    }
  }

  logSessionTelemetry()
  profileCheckpoint('before_print_import')
  const { runHeadless } = await import('src/cli/print.js')
  profileCheckpoint('after_print_import')
  void runHeadless(
    inputPrompt,
    () => headlessStore.getState(),
    headlessStore.setState,
    commandsHeadless,
    tools,
    sdkMcpConfigs,
    agentDefinitions.activeAgents,
    {
      continue: options.continue,
      resume: options.resume,
      verbose: verbose,
      outputFormat: outputFormat,
      jsonSchema,
      permissionPromptToolName: options.permissionPromptTool,
      allowedTools,
      thinkingConfig,
      maxTurns: options.maxTurns,
      maxBudgetUsd: options.maxBudgetUsd,
      taskBudget: options.taskBudget ? { total: options.taskBudget } : undefined,
      systemPrompt,
      appendSystemPrompt,
      userSpecifiedModel: effectiveModel,
      fallbackModel: userSpecifiedFallbackModel,
      teleport,
      sdkUrl,
      replayUserMessages: effectiveReplayUserMessages,
      includePartialMessages: effectiveIncludePartialMessages,
      forkSession: options.forkSession || false,
      resumeSessionAt: options.resumeSessionAt || undefined,
      rewindFiles: options.rewindFiles,
      enableAuthStatus: options.enableAuthStatus,
      agent: agentCli,
      workload: options.workload,
      setupTrigger: setupTrigger ?? undefined,
      sessionStartHooksPromise,
    },
  )
}
