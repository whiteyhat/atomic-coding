import {
  createDraftChatSession,
  createPersistedChatSession,
  DRAFT_CHAT_PREFIX,
  isDraftChatSessionId,
  type ActiveChatSession,
} from "./chat-session-state";
import type { ChatSession, WarRoom } from "./types";

export type ActiveWorkspaceTarget =
  | {
      kind: "feature";
      session: ActiveChatSession;
      initialPrompt?: string | null;
    }
  | {
      kind: "war-room-draft";
      draftId: string;
    }
  | {
      kind: "war-room";
      warRoomId: string;
    };

export type WorkstreamItem =
  | {
      id: string;
      kind: "feature-draft";
      label: string;
      description: string;
      timestamp: string | null;
      target: ActiveWorkspaceTarget;
      isActive: boolean;
    }
  | {
      id: string;
      kind: "war-room-draft";
      label: string;
      description: string;
      timestamp: string | null;
      target: ActiveWorkspaceTarget;
      isActive: boolean;
    }
  | {
      id: string;
      kind: "feature-session";
      label: string;
      description: string;
      timestamp: string;
      session: ChatSession;
      target: ActiveWorkspaceTarget;
      isActive: boolean;
    }
  | {
      id: string;
      kind: "war-room";
      label: string;
      description: string;
      timestamp: string;
      warRoom: WarRoom;
      target: ActiveWorkspaceTarget;
      isActive: boolean;
      isPipelineActive: boolean;
    };

const WAR_ROOM_DRAFT_PREFIX = "war-room-draft:";

export function createFeatureDraftTarget(
  initialPrompt?: string | null,
): ActiveWorkspaceTarget {
  return {
    kind: "feature",
    session: createDraftChatSession(),
    initialPrompt: initialPrompt?.trim() || undefined,
  };
}

export function createFeatureSessionTarget(
  sessionId: string,
): ActiveWorkspaceTarget {
  return {
    kind: "feature",
    session: createPersistedChatSession(sessionId),
  };
}

export function createWarRoomDraftTarget(): ActiveWorkspaceTarget {
  return {
    kind: "war-room-draft",
    draftId: `${WAR_ROOM_DRAFT_PREFIX}${crypto.randomUUID()}`,
  };
}

export function createWarRoomTarget(
  warRoomId: string,
): ActiveWorkspaceTarget {
  return {
    kind: "war-room",
    warRoomId,
  };
}

export function shouldAutoStartWarRoom(chatSessions: ChatSession[]): boolean {
  return chatSessions.length === 0;
}

export function getActiveWorkspaceTargetKey(
  target: ActiveWorkspaceTarget | null,
): string | null {
  if (!target) return null;

  switch (target.kind) {
    case "feature":
      return target.session.clientId;
    case "war-room-draft":
      return target.draftId;
    case "war-room":
      return target.warRoomId;
  }
}

export function isWorkspaceTargetAvailable(
  target: ActiveWorkspaceTarget,
  chatSessions: ChatSession[],
  warRooms: WarRoom[],
): boolean {
  switch (target.kind) {
    case "feature":
      return (
        isDraftChatSessionId(target.session.clientId) ||
        chatSessions.some((session) => session.id === target.session.clientId)
      );
    case "war-room-draft":
      return target.draftId.startsWith(WAR_ROOM_DRAFT_PREFIX);
    case "war-room":
      return warRooms.some((room) => room.id === target.warRoomId);
  }
}

export function buildWorkstreamItems({
  activeTarget,
  chatSessions,
  warRooms,
}: {
  activeTarget: ActiveWorkspaceTarget | null;
  chatSessions: ChatSession[];
  warRooms: WarRoom[];
}): WorkstreamItem[] {
  const items: WorkstreamItem[] = [];
  const activeKey = getActiveWorkspaceTargetKey(activeTarget);
  const promotedDraftSessionId =
    activeTarget?.kind === "feature" &&
    isDraftChatSessionId(activeTarget.session.clientId)
      ? activeTarget.session.persistedId
      : null;

  if (activeTarget?.kind === "feature" && isDraftChatSessionId(activeTarget.session.clientId)) {
    items.push({
      id: activeTarget.session.clientId,
      kind: "feature-draft",
      label:
        activeTarget.initialPrompt?.trim().slice(0, 36) || "New Feature Draft",
      description: promotedDraftSessionId
        ? "Draft in progress"
        : "Unsaved feature conversation",
      timestamp: null,
      target: activeTarget,
      isActive: activeKey === activeTarget.session.clientId,
    });
  } else if (activeTarget?.kind === "war-room-draft") {
    items.push({
      id: activeTarget.draftId,
      kind: "war-room-draft",
      label: "War Room Intake",
      description: "Drafting a new multi-agent run",
      timestamp: null,
      target: activeTarget,
      isActive: activeKey === activeTarget.draftId,
    });
  }

  const runningRooms = [...warRooms]
    .filter((room) => room.status === "planning" || room.status === "running")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const historyItems: WorkstreamItem[] = [
    ...chatSessions
      .filter((session) => session.id !== promotedDraftSessionId)
      .map((session) => ({
        id: session.id,
        kind: "feature-session" as const,
        label: session.title?.trim() || "Untitled feature chat",
        description: session.model ? "Feature chat" : "Feature conversation",
        timestamp: session.updated_at,
        session,
        target: createFeatureSessionTarget(session.id),
        isActive: activeKey === session.id,
      })),
    ...warRooms
      .filter((room) => room.status !== "planning" && room.status !== "running")
      .map((room) => ({
        id: room.id,
        kind: "war-room" as const,
        label: room.prompt.trim().slice(0, 52) || "War Room run",
        description:
          room.status === "completed"
            ? "Completed war room"
            : room.status === "failed"
              ? "Failed war room"
              : "War room run",
        timestamp: room.completed_at ?? room.created_at,
        warRoom: room,
        target: createWarRoomTarget(room.id),
        isActive: activeKey === room.id,
        isPipelineActive: false,
      })),
  ].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  items.push(
    ...runningRooms.map((room) => ({
      id: room.id,
      kind: "war-room" as const,
      label: room.prompt.trim().slice(0, 52) || "War Room run",
      description:
        room.status === "planning" ? "Planning multi-agent run" : "Live pipeline",
      timestamp: room.created_at,
      warRoom: room,
      target: createWarRoomTarget(room.id),
      isActive: activeKey === room.id,
      isPipelineActive: true,
    })),
  );

  items.push(...historyItems);

  return items;
}

export function getDefaultWorkspaceTarget(
  chatSessions: ChatSession[],
  warRooms: WarRoom[],
): ActiveWorkspaceTarget | null {
  const items = buildWorkstreamItems({
    activeTarget: null,
    chatSessions,
    warRooms,
  });

  // New game with no history — open the war room intake automatically
  if (items.length === 0) {
    return createWarRoomDraftTarget();
  }

  return items[0]?.target ?? null;
}

export function gameHasPrototype(warRooms: WarRoom[]): boolean {
  return warRooms.some((room) => room.status === "completed" && room.final_build_id !== null);
}

export function isDraftWorkstreamItem(item: WorkstreamItem): boolean {
  return item.kind === "feature-draft" || item.kind === "war-room-draft";
}

export function isFeatureTarget(
  target: ActiveWorkspaceTarget | null,
): target is Extract<ActiveWorkspaceTarget, { kind: "feature" }> {
  return target?.kind === "feature";
}

export function isWarRoomDraftTarget(
  target: ActiveWorkspaceTarget | null,
): target is Extract<ActiveWorkspaceTarget, { kind: "war-room-draft" }> {
  return target?.kind === "war-room-draft";
}

export function isWarRoomTarget(
  target: ActiveWorkspaceTarget | null,
): target is Extract<ActiveWorkspaceTarget, { kind: "war-room" }> {
  return target?.kind === "war-room";
}

export function getWorkstreamRelativeTimestamp(timestamp: string | null): string {
  if (!timestamp) return "Draft";

  const date = new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.round(diffMs / 60_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.round(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export function isFeatureDraftSession(session: ActiveChatSession): boolean {
  return session.clientId.startsWith(DRAFT_CHAT_PREFIX);
}
