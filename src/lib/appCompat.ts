import type { AppId } from "@/lib/api/types";

export type BackendAppId =
  | "claude"
  | "codex"
  | "gemini"
  | "opencode"
  | "openclaw";

export function isClaudeCompatibleApp(appId: AppId | string): boolean {
  return appId === "claude" || appId === "vipercode";
}

export function normalizeAppId(appId: AppId): BackendAppId {
  return appId === "vipercode" ? "claude" : appId;
}

export function getAppDisplayName(appId: AppId | string): string {
  switch (appId) {
    case "vipercode":
      return "Vipercode";
    case "claude":
      return "Claude";
    case "codex":
      return "Codex";
    case "gemini":
      return "Gemini";
    case "opencode":
      return "OpenCode";
    case "openclaw":
      return "OpenClaw";
    default:
      return String(appId);
  }
}
