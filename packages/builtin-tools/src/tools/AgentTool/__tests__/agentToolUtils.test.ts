import { mock, describe, expect, test } from "bun:test";

// ─── Mocks for agentToolUtils.ts dependencies ───
// Only mock modules that are truly unavailable or cause side effects.
// Do NOT mock common/shared modules (zod/v4, bootstrap/state, etc.) to avoid
// corrupting the module cache for other test files in the same Bun process.

const noop = () => {};

mock.module("bun:bundle", () => ({ feature: () => false }));

mock.module("src/services/AgentSummary/agentSummary.js", () => ({
  startAgentSummarization: noop,
}));

mock.module("src/services/analytics/index.js", () => ({
  logEvent: noop,
  logEventAsync: async () => {},
  stripProtoFields: (v: any) => v,
  attachAnalyticsSink: noop,
  _resetForTesting: noop,
  AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS: undefined,
}));

mock.module("src/utils/messages.ts", () => ({
  extractTextContent: (content: any[]) =>
    content?.filter?.((b: any) => b.type === "text")?.map?.((b: any) => b.text)?.join("") ?? "",
  getLastAssistantMessage: () => null,
  SYNTHETIC_MESSAGES: new Set(),
  INTERRUPT_MESSAGE: "",
  INTERRUPT_MESSAGE_FOR_TOOL_USE: "",
  CANCEL_MESSAGE: "",
  REJECT_MESSAGE: "",
  REJECT_MESSAGE_WITH_REASON_PREFIX: "",
  SUBAGENT_REJECT_MESSAGE: "",
  SUBAGENT_REJECT_MESSAGE_WITH_REASON_PREFIX: "",
  PLAN_REJECTION_PREFIX: "",
  DENIAL_WORKAROUND_GUIDANCE: "",
  NO_RESPONSE_REQUESTED: "",
  SYNTHETIC_TOOL_RESULT_PLACEHOLDER: "",
  SYNTHETIC_MODEL: "",
  AUTO_REJECT_MESSAGE: noop,
  DONT_ASK_REJECT_MESSAGE: noop,
  withMemoryCorrectionHint: (s: string) => s,
  deriveShortMessageId: () => "",
  isClassifierDenial: () => false,
  buildYoloRejectionMessage: () => "",
  buildClassifierUnavailableMessage: () => "",
  isEmptyMessageText: () => true,
  isThinkingMessage: () => false,
  extractTag: () => null,
  isSyntheticMessage: () => false,
  hasToolCallsInLastAssistantTurn: () => false,
  createAssistantMessage: noop,
  createAssistantAPIErrorMessage: noop,
  createUserMessage: noop,
  prepareUserContent: noop,
  createUserInterruptionMessage: noop,
  createSyntheticUserCaveatMessage: noop,
  formatCommandInputTags: noop,
  createModelSwitchBreadcrumbs: noop,
  createProgressMessage: noop,
  createToolResultStopMessage: noop,
  isNotEmptyMessage: () => true,
  deriveUUID: (uuid: string) => uuid,
  normalizeMessages: (messages: any) => messages,
  isToolUseRequestMessage: () => false,
  isToolUseResultMessage: () => false,
  reorderMessagesInUI: (messages: any) => messages,
  hasUnresolvedHooks: () => false,
  getToolResultIDs: () => ({ toolUseIDs: new Set(), toolResultIDs: new Set() }),
  getSiblingToolUseIDs: () => new Set(),
  buildMessageLookups: () => ({}),
  EMPTY_LOOKUPS: {},
  EMPTY_STRING_SET: new Set(),
  buildSubagentLookups: () => ({}),
  getSiblingToolUseIDsFromLookup: () => new Set(),
  getProgressMessagesFromLookup: () => [],
  hasUnresolvedHooksFromLookup: () => false,
  getToolUseIDs: () => new Set(),
  reorderAttachmentsForAPI: (messages: any) => messages,
  isSystemLocalCommandMessage: () => false,
  stripToolReferenceBlocksFromUserMessage: (message: any) => message,
  stripCallerFieldFromAssistantMessage: (message: any) => message,
  normalizeMessagesForAPI: (messages: any) => messages,
  mergeUserMessagesAndToolResults: (messages: any) => messages,
  mergeAssistantMessages: (a: any) => a,
  mergeUserMessages: (a: any) => a,
  mergeUserContentBlocks: (a: any) => a,
  normalizeContentFromAPI: (content: any) => content,
  stripPromptXMLTags: (content: string) => content,
  getToolUseID: () => null,
  filterUnresolvedToolUses: (messages: any) => messages,
  getAssistantMessageText: () => null,
  getUserMessageText: () => null,
  textForResubmit: () => "",
  getContentText: () => "",
  handleMessageFromStream: noop,
  wrapInSystemReminder: (content: string) => content,
  wrapMessagesInSystemReminder: (messages: any) => messages,
  PLAN_PHASE4_CONTROL: "",
  normalizeAttachmentForAPI: (attachment: any) => attachment,
  createSystemMessage: noop,
  createPermissionRetryMessage: noop,
  createBridgeStatusMessage: noop,
  createScheduledTaskFireMessage: noop,
  createStopHookSummaryMessage: noop,
  createTurnDurationMessage: noop,
  createAwaySummaryMessage: noop,
  createMemorySavedMessage: noop,
  createAgentsKilledMessage: noop,
  createApiMetricsMessage: noop,
  createCommandInputMessage: noop,
  createCompactBoundaryMessage: noop,
  createMicrocompactBoundaryMessage: noop,
  createSystemAPIErrorMessage: noop,
  isCompactBoundaryMessage: () => false,
  findLastCompactBoundaryIndex: () => -1,
  getMessagesAfterCompactBoundary: (messages: any) => messages,
  shouldShowUserMessage: () => true,
  countToolCalls: () => 0,
  hasSuccessfulToolCall: () => false,
  filterWhitespaceOnlyAssistantMessages: (messages: any) => messages,
  filterOrphanedThinkingOnlyMessages: (messages: any) => messages,
  stripSignatureBlocks: (messages: any) => messages,
  createToolUseSummaryMessage: noop,
  ensureToolResultPairing: (messages: any) => messages,
  stripAdvisorBlocks: (messages: any) => messages,
  wrapCommandText: (text: string) => text,
}));

mock.module("src/tasks/LocalAgentTask/LocalAgentTask.js", () => ({
  LocalAgentTask: {},
  completeAgentTask: noop,
  createActivityDescriptionResolver: () => ({}),
  createProgressTracker: () => ({}),
  appendMessageToLocalAgent: noop,
  backgroundAgentTask: noop,
  drainPendingMessages: () => [],
  enqueueAgentNotification: noop,
  failAgentTask: noop,
  getProgressUpdate: () => ({ tokenCount: 0, toolUseCount: 0 }),
  getTokenCountFromTracker: () => 0,
  isLocalAgentTask: () => false,
  isPanelAgentTask: () => false,
  killAsyncAgent: noop,
  killAllRunningAgentTasks: noop,
  markAgentsNotified: noop,
  queuePendingMessage: noop,
  registerAgentForeground: noop,
  registerAsyncAgent: noop,
  unregisterAgentForeground: noop,
  updateAgentProgress: noop,
  updateProgressFromMessage: noop,
  updateAgentSummary: noop,
}));

mock.module("src/utils/debug.ts", () => ({
  getMinDebugLogLevel: () => "warn",
  isDebugMode: () => false,
  enableDebugLogging: () => false,
  getDebugFilter: () => null,
  isDebugToStdErr: () => false,
  getDebugFilePath: () => null,
  setHasFormattedOutput: noop,
  getHasFormattedOutput: () => false,
  flushDebugLogs: async () => {},
  logForDebugging: noop,
  getDebugLogPath: () => "",
  logAntError: noop,
}));

mock.module("src/utils/errors.js", () => ({
  ClaudeError: class extends Error {},
  MalformedCommandError: class extends Error {},
  AbortError: class extends Error {},
  ConfigParseError: class extends Error {},
  ShellError: class extends Error {},
  TeleportOperationError: class extends Error {},
  TelemetrySafeError_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS: class extends Error {},
  isAbortError: () => false,
  hasExactErrorMessage: () => false,
  toError: (e: any) => e instanceof Error ? e : new Error(String(e)),
  errorMessage: (e: any) => String(e),
  getErrnoCode: () => undefined,
  isENOENT: () => false,
  getErrnoPath: () => undefined,
  shortErrorStack: () => "",
  isFsInaccessible: () => false,
  classifyAxiosError: () => ({ category: "unknown" }),
}));

mock.module("src/utils/permissions/yoloClassifier.js", () => ({
  buildTranscriptForClassifier: () => "",
  classifyYoloAction: () => null,
}));

mock.module("src/utils/task/sdkProgress.js", () => ({
  emitTaskProgress: noop,
}));

mock.module("src/utils/tokens.js", () => ({
  getTokenUsage: () => undefined,
  getTokenCountFromUsage: () => 0,
  tokenCountFromLastAPIResponse: () => 0,
  finalContextTokensFromLastResponse: () => 0,
  messageTokenCountFromLastAPIResponse: () => 0,
  getCurrentUsage: () => ({
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  }),
  doesMostRecentAssistantMessageExceed200k: () => false,
  getAssistantMessageContentLength: () => 0,
  tokenCountWithEstimation: () => 0,
}));

mock.module("src/tools/ExitPlanModeTool/constants.js", () => ({
  EXIT_PLAN_MODE_V2_TOOL_NAME: "exit_plan_mode",
}));

mock.module("src/tools/AgentTool/constants.js", () => ({
  AGENT_TOOL_NAME: "agent",
  LEGACY_AGENT_TOOL_NAME: "task",
}));

mock.module("src/tools/AgentTool/loadAgentsDir.js", () => ({}));

// Break circular dep
mock.module("src/tools/AgentTool/AgentTool.tsx", () => ({
  AgentTool: {},
  inputSchema: {},
  outputSchema: {},
  default: {},
}));

const {
  countToolUses,
  getLastToolUseName,
} = await import("../agentToolUtils");

function makeAssistantMessage(content: any[]): any {
  return { type: "assistant", message: { content } };
}

function makeUserMessage(text: string): any {
  return { type: "user", message: { content: text } };
}

describe("countToolUses", () => {
  test("counts tool_use blocks in messages", () => {
    const messages = [
      makeAssistantMessage([
        { type: "tool_use", name: "Read" },
        { type: "text", text: "hello" },
      ]),
    ];
    expect(countToolUses(messages)).toBe(1);
  });

  test("returns 0 for messages without tool_use", () => {
    const messages = [
      makeAssistantMessage([{ type: "text", text: "hello" }]),
    ];
    expect(countToolUses(messages)).toBe(0);
  });

  test("returns 0 for empty array", () => {
    expect(countToolUses([])).toBe(0);
  });

  test("counts multiple tool_use blocks across messages", () => {
    const messages = [
      makeAssistantMessage([{ type: "tool_use", name: "Read" }]),
      makeUserMessage("ok"),
      makeAssistantMessage([{ type: "tool_use", name: "Write" }]),
    ];
    expect(countToolUses(messages)).toBe(2);
  });

  test("counts tool_use in single message with multiple blocks", () => {
    const messages = [
      makeAssistantMessage([
        { type: "tool_use", name: "Read" },
        { type: "tool_use", name: "Grep" },
        { type: "tool_use", name: "Write" },
      ]),
    ];
    expect(countToolUses(messages)).toBe(3);
  });
});

describe("getLastToolUseName", () => {
  test("returns last tool name from assistant message", () => {
    const msg = makeAssistantMessage([
      { type: "tool_use", name: "Read" },
      { type: "tool_use", name: "Write" },
    ]);
    expect(getLastToolUseName(msg)).toBe("Write");
  });

  test("returns undefined for message without tool_use", () => {
    const msg = makeAssistantMessage([{ type: "text", text: "hello" }]);
    expect(getLastToolUseName(msg)).toBeUndefined();
  });

  test("returns the last tool when multiple tool_uses present", () => {
    const msg = makeAssistantMessage([
      { type: "tool_use", name: "Read" },
      { type: "tool_use", name: "Grep" },
      { type: "tool_use", name: "Edit" },
    ]);
    expect(getLastToolUseName(msg)).toBe("Edit");
  });

  test("returns undefined for non-assistant message", () => {
    const msg = makeUserMessage("hello");
    expect(getLastToolUseName(msg)).toBeUndefined();
  });

  test("handles message with null content", () => {
    const msg = { type: "assistant", message: { content: null } } as any;
    expect(getLastToolUseName(msg)).toBeUndefined();
  });
});
