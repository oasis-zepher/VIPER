// 前端统一使用 AppId 作为应用标识。
// `vipercode` 是前端别名应用，后端运行时映射到 Claude-compatible 逻辑。
export type AppId =
  | "claude"
  | "vipercode"
  | "codex"
  | "gemini"
  | "opencode"
  | "openclaw";
