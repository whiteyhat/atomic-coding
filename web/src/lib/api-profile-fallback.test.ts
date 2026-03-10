import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMyProfile, updateMyProfile } from "./api";

const sampleProfile = {
  id: "did:privy:test-user",
  email: "creator@example.com",
  display_name: "Creator",
  avatar_url: null,
  wallet_address: null,
  created_at: "2026-03-10T12:00:00.000Z",
  updated_at: "2026-03-10T12:00:00.000Z",
};

describe("profile API fallback", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to the legacy profile read endpoint when /users/me returns 404", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(sampleProfile), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const profile = await getMyProfile(sampleProfile.id);

    expect(profile.id).toBe(sampleProfile.id);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/users/me");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      `/users/profile/${encodeURIComponent(sampleProfile.id)}`,
    );
  });

  it("falls back to the legacy profile upsert endpoint when /users/me update returns 404", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...sampleProfile,
            display_name: "Updated Creator",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    const profile = await updateMyProfile(sampleProfile.id, {
      display_name: "Updated Creator",
    });

    expect(profile.display_name).toBe("Updated Creator");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/users/me");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/users/profile");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
    });
  });
});
