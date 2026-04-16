import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test";
import { getAPIProvider, isFirstPartyAnthropicBaseUrl } from "../providers";

// Mock getInitialSettings to avoid reading local settings.json
// which may have modelType: 'openai' in dev environments
mock.module("@anthropic/config", () => ({
  getInitialSettings: () => ({}),
}));

describe("getAPIProvider", () => {
  const envKeys = [
    "CLAUDE_CODE_USE_OPENAI",
    "CLAUDE_CODE_USE_GLM",
    "CLAUDE_CODE_USE_DEEPSEEK",
    "CLAUDE_CODE_USE_QWEN",
    "CLAUDE_CODE_USE_GEMINI",
    "CLAUDE_CODE_USE_GROK",
    "CLAUDE_CODE_USE_BEDROCK",
    "CLAUDE_CODE_USE_VERTEX",
    "CLAUDE_CODE_USE_FOUNDRY",
  ] as const;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of envKeys) savedEnv[key] = process.env[key];
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  test('returns "firstParty" by default', () => {
    delete process.env.CLAUDE_CODE_USE_BEDROCK;
    delete process.env.CLAUDE_CODE_USE_VERTEX;
    delete process.env.CLAUDE_CODE_USE_FOUNDRY;
    delete process.env.CLAUDE_CODE_USE_OPENAI;
    delete process.env.CLAUDE_CODE_USE_GLM;
    delete process.env.CLAUDE_CODE_USE_DEEPSEEK;
    delete process.env.CLAUDE_CODE_USE_QWEN;
    delete process.env.CLAUDE_CODE_USE_GEMINI;
    delete process.env.CLAUDE_CODE_USE_GROK;
    expect(getAPIProvider()).toBe("firstParty");
  });

  test('returns "glm" when CLAUDE_CODE_USE_GLM is set', () => {
    process.env.CLAUDE_CODE_USE_GLM = "1";
    expect(getAPIProvider()).toBe("glm");
  });

  test('returns "deepseek" when CLAUDE_CODE_USE_DEEPSEEK is set', () => {
    process.env.CLAUDE_CODE_USE_DEEPSEEK = "1";
    expect(getAPIProvider()).toBe("deepseek");
  });

  test('returns "qwen" when CLAUDE_CODE_USE_QWEN is set', () => {
    process.env.CLAUDE_CODE_USE_QWEN = "1";
    expect(getAPIProvider()).toBe("qwen");
  });

  test('returns "gemini" when CLAUDE_CODE_USE_GEMINI is set', () => {
    process.env.CLAUDE_CODE_USE_GEMINI = "1";
    expect(getAPIProvider()).toBe("gemini");
  });

  test('returns "grok" when CLAUDE_CODE_USE_GROK is set', () => {
    process.env.CLAUDE_CODE_USE_GROK = "1";
    expect(getAPIProvider()).toBe("grok");
  });

  test('returns "bedrock" when CLAUDE_CODE_USE_BEDROCK is set', () => {
    delete process.env.CLAUDE_CODE_USE_OPENAI;
    process.env.CLAUDE_CODE_USE_BEDROCK = "1";
    expect(getAPIProvider()).toBe("bedrock");
  });

  test('returns "vertex" when CLAUDE_CODE_USE_VERTEX is set', () => {
    delete process.env.CLAUDE_CODE_USE_OPENAI;
    process.env.CLAUDE_CODE_USE_VERTEX = "1";
    expect(getAPIProvider()).toBe("vertex");
  });

  test('returns "foundry" when CLAUDE_CODE_USE_FOUNDRY is set', () => {
    delete process.env.CLAUDE_CODE_USE_OPENAI;
    process.env.CLAUDE_CODE_USE_FOUNDRY = "1";
    expect(getAPIProvider()).toBe("foundry");
  });

  test("bedrock takes precedence over vertex", () => {
    delete process.env.CLAUDE_CODE_USE_OPENAI;
    process.env.CLAUDE_CODE_USE_BEDROCK = "1";
    process.env.CLAUDE_CODE_USE_VERTEX = "1";
    expect(getAPIProvider()).toBe("bedrock");
  });

  test("openai takes precedence over glm/deepseek/qwen/gemini/grok env vars", () => {
    process.env.CLAUDE_CODE_USE_OPENAI = "1";
    process.env.CLAUDE_CODE_USE_GLM = "1";
    process.env.CLAUDE_CODE_USE_DEEPSEEK = "1";
    process.env.CLAUDE_CODE_USE_QWEN = "1";
    process.env.CLAUDE_CODE_USE_GEMINI = "1";
    process.env.CLAUDE_CODE_USE_GROK = "1";
    expect(getAPIProvider()).toBe("openai");
  });

  test("bedrock wins when all three env vars are set", () => {
    delete process.env.CLAUDE_CODE_USE_OPENAI;
    process.env.CLAUDE_CODE_USE_BEDROCK = "1";
    process.env.CLAUDE_CODE_USE_VERTEX = "1";
    process.env.CLAUDE_CODE_USE_FOUNDRY = "1";
    expect(getAPIProvider()).toBe("bedrock");
  });

  test('"true" is truthy', () => {
    delete process.env.CLAUDE_CODE_USE_OPENAI;
    process.env.CLAUDE_CODE_USE_BEDROCK = "true";
    expect(getAPIProvider()).toBe("bedrock");
  });

  test('"0" is not truthy', () => {
    delete process.env.CLAUDE_CODE_USE_OPENAI;
    process.env.CLAUDE_CODE_USE_BEDROCK = "0";
    expect(getAPIProvider()).toBe("firstParty");
  });

  test('empty string is not truthy', () => {
    delete process.env.CLAUDE_CODE_USE_OPENAI;
    process.env.CLAUDE_CODE_USE_BEDROCK = "";
    expect(getAPIProvider()).toBe("firstParty");
  });
});

describe("isFirstPartyAnthropicBaseUrl", () => {
  const originalBaseUrl = process.env.ANTHROPIC_BASE_URL;
  const originalUserType = process.env.USER_TYPE;

  afterEach(() => {
    if (originalBaseUrl !== undefined) {
      process.env.ANTHROPIC_BASE_URL = originalBaseUrl;
    } else {
      delete process.env.ANTHROPIC_BASE_URL;
    }
    if (originalUserType !== undefined) {
      process.env.USER_TYPE = originalUserType;
    } else {
      delete process.env.USER_TYPE;
    }
  });

  test("returns true when ANTHROPIC_BASE_URL is not set", () => {
    delete process.env.ANTHROPIC_BASE_URL;
    expect(isFirstPartyAnthropicBaseUrl()).toBe(true);
  });

  test("returns true for api.anthropic.com", () => {
    process.env.ANTHROPIC_BASE_URL = "https://api.anthropic.com";
    expect(isFirstPartyAnthropicBaseUrl()).toBe(true);
  });

  test("returns false for custom URL", () => {
    process.env.ANTHROPIC_BASE_URL = "https://my-proxy.com";
    expect(isFirstPartyAnthropicBaseUrl()).toBe(false);
  });

  test("returns false for invalid URL", () => {
    process.env.ANTHROPIC_BASE_URL = "not-a-url";
    expect(isFirstPartyAnthropicBaseUrl()).toBe(false);
  });

  test("returns true for staging URL when USER_TYPE is ant", () => {
    process.env.ANTHROPIC_BASE_URL = "https://api-staging.anthropic.com";
    process.env.USER_TYPE = "ant";
    expect(isFirstPartyAnthropicBaseUrl()).toBe(true);
  });

  test("returns true for URL with path", () => {
    process.env.ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1";
    expect(isFirstPartyAnthropicBaseUrl()).toBe(true);
  });

  test("returns true for trailing slash", () => {
    process.env.ANTHROPIC_BASE_URL = "https://api.anthropic.com/";
    expect(isFirstPartyAnthropicBaseUrl()).toBe(true);
  });

  test("returns false for subdomain attack", () => {
    process.env.ANTHROPIC_BASE_URL = "https://evil-api.anthropic.com";
    expect(isFirstPartyAnthropicBaseUrl()).toBe(false);
  });
});
