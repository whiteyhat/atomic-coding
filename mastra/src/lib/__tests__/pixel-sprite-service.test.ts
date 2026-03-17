import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateCharacter,
  generateSpriteSheet,
} from "../pixel-sprite-service.js";

describe("pixel-sprite-service client", () => {
  beforeEach(() => {
    process.env.PIXEL_SPRITE_SERVICE_URL = "https://sprite.example";
    process.env.PIXEL_SPRITE_SERVICE_TIMEOUT_MS = "50";
    process.env.PIXEL_SPRITE_SERVICE_KEY = "test-key";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a successful generate-character request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        imageUrl: "https://sprite.example/out/character.png",
        width: 512,
        height: 512,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateCharacter({
        prompt: "agile hero",
        referenceImageUrl: "https://cdn.example/reference.png",
      }),
    ).resolves.toEqual({
      imageUrl: "https://sprite.example/out/character.png",
      width: 512,
      height: 512,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://sprite.example/api/generate-character",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          "x-api-key": "test-key",
        }),
      }),
    );
  });

  it("surfaces upstream service errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({ error: "upstream render failed" }),
      }),
    );

    await expect(
      generateSpriteSheet({
        characterImageUrl: "https://sprite.example/out/character.png",
        type: "idle",
      }),
    ).rejects.toThrow("upstream render failed");
  });

  it("rejects malformed JSON payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    );

    await expect(
      generateCharacter({
        prompt: "agile hero",
      }),
    ).rejects.toThrow("invalid character payload");
  });

  it("times out when the service does not respond", async () => {
    process.env.PIXEL_SPRITE_SERVICE_TIMEOUT_MS = "1";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("AbortError");
            (error as Error & { name: string }).name = "AbortError";
            reject(error);
          });
        }),
      ),
    );

    await expect(
      generateCharacter({
        prompt: "agile hero",
      }),
    ).rejects.toThrow("timed out");
  });
});
