import { describe, expect, it } from "vitest";
import type { ChatSession, WarRoom } from "./types";
import {
  buildWorkstreamItems,
  createFeatureDraftTarget,
  createWarRoomDraftTarget,
  getDefaultWorkspaceTarget,
  shouldAutoStartWarRoom,
} from "./workstreams";

function makeChatSession(
  overrides: Partial<ChatSession> & { id: string },
): ChatSession {
  const { id, ...rest } = overrides;
  return {
    id,
    game_id: "game-1",
    title: "Chat session",
    model: "google/gemini-3-pro-preview",
    created_at: "2026-03-10T10:00:00.000Z",
    updated_at: "2026-03-10T10:00:00.000Z",
    ...rest,
  };
}

function makeWarRoom(
  overrides: Partial<WarRoom> & { id: string },
): WarRoom {
  const { id, game_format, ...rest } = overrides;
  return {
    id,
    game_id: "game-1",
    user_id: "user-1",
    prompt: "War room prompt",
    genre: "arena-dogfighter",
    game_format: game_format ?? "3d",
    status: "completed",
    scope: null,
    visual_references: [],
    suggested_prompts: null,
    final_build_id: null,
    created_at: "2026-03-10T10:00:00.000Z",
    completed_at: "2026-03-10T10:15:00.000Z",
    ...rest,
  };
}

describe("workstreams", () => {
  it("auto-starts war room only when there are zero chat sessions", () => {
    expect(shouldAutoStartWarRoom([])).toBe(true);
    expect(
      shouldAutoStartWarRoom([
        makeChatSession({ id: "session-1" }),
      ]),
    ).toBe(false);
  });

  it("orders local drafts first, then live war rooms, then chat and terminal history by recency", () => {
    const items = buildWorkstreamItems({
      activeTarget: createFeatureDraftTarget("Add boss phase"),
      chatSessions: [
        makeChatSession({
          id: "chat-newer",
          title: "Newer chat",
          updated_at: "2026-03-10T13:00:00.000Z",
        }),
        makeChatSession({
          id: "chat-older",
          title: "Older chat",
          updated_at: "2026-03-10T11:00:00.000Z",
        }),
      ],
      warRooms: [
        makeWarRoom({
          id: "room-running",
          prompt: "Live run",
          status: "running",
          created_at: "2026-03-10T12:30:00.000Z",
          completed_at: null,
        }),
        makeWarRoom({
          id: "room-terminal",
          prompt: "Finished run",
          status: "completed",
          completed_at: "2026-03-10T12:45:00.000Z",
        }),
      ],
    });

    expect(items.map((item) => item.id)).toEqual([
      items[0].id,
      "room-running",
      "chat-newer",
      "room-terminal",
      "chat-older",
    ]);
    expect(items[0].kind).toBe("feature-draft");
  });

  it("returns the best default target when no explicit target is active", () => {
    const target = getDefaultWorkspaceTarget(
      [makeChatSession({ id: "chat-1" })],
      [
        makeWarRoom({
          id: "room-running",
          status: "running",
          completed_at: null,
        }),
      ],
    );

    expect(target).toEqual({
      kind: "war-room",
      warRoomId: "room-running",
    });
  });

  it("surfaces a war room draft as the first draft item", () => {
    const draftTarget = createWarRoomDraftTarget();
    const items = buildWorkstreamItems({
      activeTarget: draftTarget,
      chatSessions: [],
      warRooms: [],
    });

    expect(items[0].kind).toBe("war-room-draft");
    expect(items[0].target).toEqual(draftTarget);
  });
});
