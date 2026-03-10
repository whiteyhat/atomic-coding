import { describe, expect, it } from "vitest";
import type { AppHealthStatus } from "./types";
import { buildSettingsHealthItems, buildSettingsPlatformItems } from "./settings";

describe("buildSettingsPlatformItems", () => {
  it("maps runtime health config into platform overview cards", () => {
    const health: AppHealthStatus = {
      status: "ok",
      checks: {
        web: "ok",
        supabase: "ok",
        mastra: "ok",
      },
      config: {
        apiBaseHost: "api.example.com",
        supabaseHost: "db.example.com",
        mastraHost: "agents.example.com",
        privyConfigured: true,
        mastraConfigured: true,
      },
    };

    const items = buildSettingsPlatformItems(health);

    expect(items.find((item) => item.label === "API base")?.value).toBe("api.example.com");
    expect(items.find((item) => item.label === "Supabase")?.value).toBe("db.example.com");
    expect(items.find((item) => item.label === "Mastra")?.value).toBe("agents.example.com");
    expect(items.find((item) => item.label === "Privy")?.value).toBe("Configured");
    expect(items.find((item) => item.label === "Supported models")?.value).toContain("Gemini 3 Pro");
  });
});

describe("buildSettingsHealthItems", () => {
  it("labels not-configured Mastra separately from failures", () => {
    const health: AppHealthStatus = {
      status: "ok",
      checks: {
        web: "ok",
        supabase: "ok",
        mastra: "not_configured",
      },
      config: {
        apiBaseHost: "api.example.com",
        supabaseHost: "db.example.com",
        mastraHost: null,
        privyConfigured: true,
        mastraConfigured: false,
      },
    };

    const items = buildSettingsHealthItems(health);

    expect(items.find((item) => item.key === "mastra")).toMatchObject({
      status: "not_configured",
      description: "Optional orchestration service is not configured in this environment.",
    });
  });

  it("returns degraded placeholders when health data is unavailable", () => {
    const items = buildSettingsHealthItems(null);

    expect(items).toHaveLength(3);
    expect(items.every((item) => item.status === "error")).toBe(true);
  });
});
