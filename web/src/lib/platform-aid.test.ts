import { describe, expect, it } from "vitest";
import {
  getPlatformAidFallbackSuggestions,
  getPlatformAidIntro,
  getPlatformAidPageId,
  getPlatformAidSessionId,
  isPlatformAidRoute,
  mergePlatformAidSuggestions,
  parsePlatformAidEvent,
  PLATFORM_AID_OPENED_KEY,
  PLATFORM_AID_SESSION_KEY,
  setPlatformAidOpened,
} from "./platform-aid";

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length() {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe("platform aid helpers", () => {
  it("maps dashboard-family routes to page ids", () => {
    expect(getPlatformAidPageId("/dashboard")).toBe("dashboard");
    expect(getPlatformAidPageId("/analytics")).toBe("analytics");
    expect(getPlatformAidPageId("/library")).toBe("library");
    expect(getPlatformAidPageId("/settings")).toBe("settings");
    expect(getPlatformAidPageId("/openclaw/docs")).toBe("other");
    expect(getPlatformAidPageId("/games/test")).toBe("other");
  });

  it("gates platform aid to dashboard-family routes only", () => {
    expect(isPlatformAidRoute("/dashboard")).toBe(true);
    expect(isPlatformAidRoute("/openclaw")).toBe(true);
    expect(isPlatformAidRoute("/openclaw/docs")).toBe(false);
    expect(isPlatformAidRoute("/library")).toBe(true);
    expect(isPlatformAidRoute("/games/My%20Game")).toBe(true);
    expect(isPlatformAidRoute("/")).toBe(false);
  });

  it("creates and reuses a stable session id from storage", () => {
    const storage = new MemoryStorage();
    const first = getPlatformAidSessionId(storage);
    const second = getPlatformAidSessionId(storage);

    expect(first).toBe(second);
    expect(storage.getItem(PLATFORM_AID_SESSION_KEY)).toBe(first);
  });

  it("persists first-open state", () => {
    const storage = new MemoryStorage();
    setPlatformAidOpened(storage, true);
    expect(storage.getItem(PLATFORM_AID_OPENED_KEY)).toBe("true");
  });

  it("merges remote suggestions with page fallbacks and dedupes them", () => {
    expect(
      mergePlatformAidSuggestions("dashboard", [
        "How do I create my first game?",
        "How do I create my first game?",
        "Where do I publish from?",
      ]),
    ).toEqual([
      "How do I create my first game?",
      "Where do I publish from?",
      getPlatformAidFallbackSuggestions("dashboard")[1],
    ]);
  });

  it("parses done events with actions and token fallback payloads", () => {
    expect(
      parsePlatformAidEvent(
        JSON.stringify({
          type: "done",
          reply: "Answer ready.",
          suggestions: ["One", "Two"],
          actions: [{ label: "Open Library", href: "/library" }],
        }),
      ),
    ).toEqual({
      type: "done",
      reply: "Answer ready.",
      latencyMs: undefined,
      model: undefined,
      suggestions: ["One", "Two"],
      actions: [{ label: "Open Library", href: "/library" }],
      contexts: undefined,
    });

    expect(parsePlatformAidEvent("plain token")).toEqual({
      type: "token",
      token: "plain token",
    });
  });

  it("builds route-aware intro copy", () => {
    expect(getPlatformAidIntro("dashboard", "Carlos")).toContain("Carlos");
    expect(getPlatformAidIntro("openclaw")).toContain("OpenClaw");
    expect(getPlatformAidIntro("analytics")).toContain("architecture");
  });
});
