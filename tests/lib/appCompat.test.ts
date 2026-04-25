import { describe, expect, it } from "vitest";
import {
  getAppDisplayName,
  isClaudeCompatibleApp,
  normalizeAppId,
} from "@/lib/appCompat";

describe("appCompat", () => {
  it("treats vipercode as a Claude-compatible app", () => {
    expect(isClaudeCompatibleApp("vipercode")).toBe(true);
    expect(normalizeAppId("vipercode")).toBe("claude");
  });

  it("keeps non-alias apps unchanged", () => {
    expect(isClaudeCompatibleApp("codex")).toBe(false);
    expect(normalizeAppId("codex")).toBe("codex");
  });

  it("returns stable display names", () => {
    expect(getAppDisplayName("vipercode")).toBe("Vipercode");
    expect(getAppDisplayName("claude")).toBe("Claude");
  });
});
