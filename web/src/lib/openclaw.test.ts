import { describe, expect, it } from "vitest";
import {
  buildOpenClawClaimPrompt,
  buildOpenClawFallbackEnvelope,
  buildOpenClawFrontendManifest,
  formatOpenClawRelativeTime,
  formatOpenClawTimeRemaining,
  getOpenClawWizardStep,
  mergeOpenClawOnboardingSession,
} from "./openclaw";

describe("openclaw helpers", () => {
  it("formats remaining claim time in minutes and hours", () => {
    const now = new Date("2026-03-10T12:00:00.000Z").getTime();

    expect(
      formatOpenClawTimeRemaining("2026-03-10T12:09:30.000Z", now),
    ).toBe("10m remaining");
    expect(
      formatOpenClawTimeRemaining("2026-03-10T14:15:00.000Z", now),
    ).toBe("2h 15m remaining");
    expect(
      formatOpenClawTimeRemaining("2026-03-10T11:59:00.000Z", now),
    ).toBe("Expired");
  });

  it("derives relative timestamps for recent and future values", () => {
    const now = new Date("2026-03-10T12:00:00.000Z").getTime();

    expect(formatOpenClawRelativeTime("2026-03-10T11:31:00.000Z", now)).toBe("29m ago");
    expect(formatOpenClawRelativeTime("2026-03-10T16:00:00.000Z", now)).toBe("in 4h");
    expect(formatOpenClawRelativeTime(null, now)).toBe("Never");
  });

  it("maps onboarding sessions to wizard steps", () => {
    expect(getOpenClawWizardStep(null)).toBe(0);
    expect(
      getOpenClawWizardStep({
        session_id: "session-1",
        status: "pending_claim",
        mode: "import",
        expires_at: "2026-03-10T12:15:00.000Z",
        claimed_at: null,
        agent_id: null,
        replaces_agent_id: null,
        identity: null,
        agent_url: null,
        endpoint_url: null,
        webhook_events: ["*"],
        last_error: null,
        created_at: "2026-03-10T12:00:00.000Z",
        updated_at: "2026-03-10T12:00:00.000Z",
      }),
    ).toBe(1);
    expect(
      getOpenClawWizardStep({
        session_id: "session-2",
        status: "claimed",
        mode: "replace",
        expires_at: "2026-03-10T12:15:00.000Z",
        claimed_at: "2026-03-10T12:04:00.000Z",
        agent_id: "agent-1",
        replaces_agent_id: "agent-0",
        identity: {
          name: "OpenClaw",
          description: null,
          avatar: "🦞",
        },
        agent_url: "https://agent.example.com",
        endpoint_url: null,
        webhook_events: ["*"],
        last_error: null,
        created_at: "2026-03-10T12:00:00.000Z",
        updated_at: "2026-03-10T12:04:00.000Z",
      }),
    ).toBe(2);
  });

  it("builds the claim prompt from the onboarding session", () => {
    const prompt = buildOpenClawClaimPrompt({
      session_id: "session-42",
      expires_at: "2026-03-10T12:15:00.000Z",
      onboarding_url: " https://example.com/openclaw/claim/token ",
      mode: "import",
    });

    expect(prompt).toContain("complete the OpenClaw import flow");
    expect(prompt).toContain("store the returned Atomic credentials");
    expect(prompt).toContain("session-42");
    expect(prompt).toContain("https://example.com/openclaw/claim/token");
  });

  it("preserves the onboarding URL when polling returns a redacted session snapshot", () => {
    const merged = mergeOpenClawOnboardingSession(
      {
        session_id: "session-42",
        status: "pending_claim",
        mode: "import",
        expires_at: "2026-03-10T12:15:00.000Z",
        claimed_at: null,
        agent_id: null,
        replaces_agent_id: null,
        identity: null,
        agent_url: null,
        endpoint_url: null,
        webhook_events: ["*"],
        last_error: null,
        created_at: "2026-03-10T12:00:00.000Z",
        updated_at: "2026-03-10T12:00:00.000Z",
        onboarding_url: "https://example.com/openclaw/claim/token",
      },
      {
        session_id: "session-42",
        status: "pending_claim",
        mode: "import",
        expires_at: "2026-03-10T12:15:00.000Z",
        claimed_at: null,
        agent_id: null,
        replaces_agent_id: null,
        identity: null,
        agent_url: null,
        endpoint_url: null,
        webhook_events: ["*"],
        last_error: null,
        created_at: "2026-03-10T12:00:00.000Z",
        updated_at: "2026-03-10T12:01:00.000Z",
      },
    );

    expect(merged.onboarding_url).toBe("https://example.com/openclaw/claim/token");
  });

  it("builds a local manifest fallback for environments missing the backend route", () => {
    const manifest = buildOpenClawFrontendManifest("https://api.example.com");
    const envelope = buildOpenClawFallbackEnvelope("https://api.example.com");

    expect(manifest.api_base_url).toBe("https://api.example.com/openclaw/tools");
    expect(manifest.capabilities.length).toBeGreaterThan(0);
    expect(envelope.agent).toBeNull();
    expect(envelope.skill_json_url).toBe("https://api.example.com/openclaw/skill.json");
  });
});
