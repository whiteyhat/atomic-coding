import { Hono, type Context } from "npm:hono@^4.9.7";
import { z } from "npm:zod@^3.23.0";
import * as atoms from "./services/atoms.ts";
import * as builds from "./services/builds.ts";
import * as boilerplates from "./services/boilerplates.ts";
import * as chat from "./services/chat.ts";
import * as externals from "./services/externals.ts";
import * as games from "./services/games.ts";
import * as openclaw from "./services/openclaw.ts";
import * as tokens from "./services/tokens.ts";
import * as users from "./services/users.ts";
import * as warrooms from "./services/warrooms.ts";
import * as schemas from "./schemas.ts";
import { requireAuth } from "./auth.ts";
import { requireOpenClawApiKey } from "./openclaw-auth.ts";
import {
  buildOpenClawSkillJson,
  buildOpenClawSkillMarkdown,
  getApiBaseFromRequest,
} from "./openclaw.ts";

type ErrorWithStatus = Error & { status?: number };

const toolCreateGameSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  genre: z.string().max(50).optional(),
  game_format: z.enum(["2d", "3d"]).optional(),
});

const toolReadAtomsSchema = z.object({
  names: z.array(z.string().min(1)).min(1).max(50),
});

const toolSearchAtomsSchema = z.object({
  query: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(20).optional(),
});

const toolCreateChatSessionSchema = z.object({
  model: z.string().max(100).optional(),
  title: z.string().max(200).optional(),
});

const toolSaveMessagesSchema = z.object({
  messages: z
    .array(
      z.object({
        message_id: z.string().min(1),
        role: z.string().min(1),
        parts: z.array(z.unknown()),
      }),
    )
    .min(1)
    .max(200),
});

const toolCreateWarRoomSchema = z.object({
  prompt: z.string().min(1).max(2000),
  genre: z.string().max(50).optional(),
});

const toolTokenSchema = z.object({
  token_name: z.string().min(1).max(50),
  token_symbol: z.string().min(1).max(10),
  chain_id: z.string().max(50).optional(),
  total_supply: z.number().optional(),
  leaderboard_allocation_pct: z.number().min(0).max(100).optional(),
});

function createError(message: string, status = 400): ErrorWithStatus {
  const error = new Error(message) as ErrorWithStatus;
  error.status = status;
  return error;
}

async function withJson<T>(
  c: Context,
  handler: () => Promise<T>,
) {
  try {
    return c.json(await handler());
  } catch (error) {
    const status = (error as ErrorWithStatus).status ?? 400;
    const message = error instanceof Error ? error.message : String(error);
    c.set("openclawToolError", message);
    return c.json({ error: message }, status);
  }
}

async function ensureProfile(userId: string) {
  const profile = await users.getUserProfile(userId);
  if (!profile) {
    await users.upsertUserProfile({ id: userId });
  }
}

async function ensureOwnedGame(userId: string, gameName: string) {
  const game = await openclaw.getOwnedGameRecordByName(userId, gameName);
  if (!game) {
    throw createError(`Game not found: "${gameName}"`, 404);
  }
  return game;
}

async function ensureOwnedSession(userId: string, gameName: string, sessionId: string) {
  const game = await ensureOwnedGame(userId, gameName);
  let session: Awaited<ReturnType<typeof chat.getSession>>;
  try {
    session = await chat.getSession(sessionId);
  } catch {
    throw createError("Chat session not found", 404);
  }
  if (session.game_id !== game.id) {
    throw createError("Chat session not found", 404);
  }
  return { game, session };
}

async function ensureOwnedWarRoom(userId: string, gameName: string, warRoomId: string) {
  const game = await ensureOwnedGame(userId, gameName);
  const room = await warrooms.getWarRoom(warRoomId);
  if (!room || room.game_id !== game.id) {
    throw createError("War room not found", 404);
  }
  return { game, room };
}

export const openClawRouter = new Hono();

openClawRouter.use("/openclaw/tools/*", requireOpenClawApiKey(), async (c, next) => {
  const startedAt = performance.now();
  try {
    await next();
  } finally {
    const context = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext | undefined;
    if (!context) return;
    const path = new URL(c.req.url).pathname;
    const toolName = path
      .replace(/^.*\/openclaw\/tools\//, "")
      .replace(/^\//, "")
      .replace(/\//g, ".");
    await openclaw.logOpenClawRequest({
      agentId: context.agent_id,
      userId: context.user_id,
      toolName,
      method: c.req.method,
      statusCode: c.res.status,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      error: c.get("openclawToolError") as string | undefined,
    });
  }
});

// =============================================================================
// Owner-auth routes
// =============================================================================

openClawRouter.get("/openclaw/agent", requireAuth(), async (c) =>
  withJson(c, async () => {
    const authUser = c.get("authUser") as { userId: string };
    const agent = await openclaw.getCurrentAgent(authUser.userId);
    const apiBase = getApiBaseFromRequest(c.req.raw);
    return {
      agent,
      api_base_url: `${apiBase}/openclaw/tools`,
      skill_manifest_url: `${apiBase}/openclaw/skill.md`,
      skill_json_url: `${apiBase}/openclaw/skill.json`,
      heartbeat_url: `${apiBase}/openclaw/tools/heartbeat`,
      docs_url: `${apiBase}/openclaw/docs`,
      capabilities: buildOpenClawSkillJson(apiBase).capabilities,
      webhook_events: buildOpenClawSkillJson(apiBase).webhook_events,
    };
  }),
);

openClawRouter.post("/openclaw/onboarding", requireAuth(), async (c) =>
  withJson(c, async () => {
    const authUser = c.get("authUser") as { userId: string };
    await ensureProfile(authUser.userId);
    const { token, session } = await openclaw.createOnboardingSession(
      authUser.userId,
      "import",
      null,
    );
    const apiBase = getApiBaseFromRequest(c.req.raw);
    return {
      ...session,
      onboarding_url: `${apiBase}/openclaw/claim/${token}`,
    };
  }),
);

openClawRouter.get("/openclaw/onboarding/:id", requireAuth(), async (c) =>
  withJson(c, async () => {
    const authUser = c.get("authUser") as { userId: string };
    const session = await openclaw.getOnboardingSessionForUser(
      c.req.param("id"),
      authUser.userId,
    );
    if (!session) {
      throw createError("Onboarding session not found", 404);
    }
    return session;
  }),
);

openClawRouter.post("/openclaw/onboarding/:id/cancel", requireAuth(), async (c) =>
  withJson(c, async () => {
    const authUser = c.get("authUser") as { userId: string };
    const session = await openclaw.cancelOnboardingSessionForUser(
      c.req.param("id"),
      authUser.userId,
    );
    if (!session) {
      throw createError("Onboarding session not found", 404);
    }
    return session;
  }),
);

openClawRouter.post("/openclaw/agent/replace", requireAuth(), async (c) =>
  withJson(c, async () => {
    const authUser = c.get("authUser") as { userId: string };
    const current = await openclaw.getCurrentAgent(authUser.userId);
    if (!current) {
      throw createError("No imported OpenClaw agent found to replace", 404);
    }
    const { token, session } = await openclaw.createOnboardingSession(
      authUser.userId,
      "replace",
      current.id,
    );
    const apiBase = getApiBaseFromRequest(c.req.raw);
    return {
      ...session,
      onboarding_url: `${apiBase}/openclaw/claim/${token}`,
    };
  }),
);

openClawRouter.post("/openclaw/agent/connection-test", requireAuth(), async (c) =>
  withJson(c, async () => {
    const authUser = c.get("authUser") as { userId: string };
    const agent = await openclaw.refreshCurrentAgentConnectionStatus(authUser.userId);
    if (!agent) {
      throw createError("No imported OpenClaw agent found", 404);
    }
    return agent;
  }),
);

openClawRouter.get("/openclaw/agent/health-score", requireAuth(), async (c) =>
  withJson(c, async () => {
    const authUser = c.get("authUser") as { userId: string };
    const score = await openclaw.computeOpenClawHealthScore(authUser.userId);
    if (!score) {
      throw createError("No imported OpenClaw agent found", 404);
    }
    return score;
  }),
);

openClawRouter.get("/openclaw/agent/activity", requireAuth(), async (c) =>
  withJson(c, async () => {
    const authUser = c.get("authUser") as { userId: string };
    const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 100);
    const offset = Math.max(parseInt(c.req.query("offset") || "0", 10), 0);
    return openclaw.listOpenClawActivity(authUser.userId, limit, offset);
  }),
);

openClawRouter.get("/openclaw/agent/webhook-log", requireAuth(), async (c) =>
  withJson(c, async () => {
    const authUser = c.get("authUser") as { userId: string };
    const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);
    return openclaw.listWebhookDeliveries(authUser.userId, limit);
  }),
);

openClawRouter.get("/openclaw/agent/webhook-config", requireAuth(), async (c) =>
  withJson(c, async () => {
    const authUser = c.get("authUser") as { userId: string };
    const agent = await openclaw.getCurrentAgent(authUser.userId);
    if (!agent) {
      throw createError("No imported OpenClaw agent found", 404);
    }
    return {
      delivery_channel: agent.delivery_channel,
      endpoint_url: agent.endpoint_url,
      telegram_bot_token: null,
      telegram_chat_id: agent.telegram_chat_id,
      webhook_events: agent.webhook_events,
    };
  }),
);

openClawRouter.put("/openclaw/agent/webhook-config", requireAuth(), async (c) =>
  withJson(c, async () => {
    const authUser = c.get("authUser") as { userId: string };
    const body = schemas.openClawWebhookConfigSchema.parse(await c.req.json());
    const agent = await openclaw.updateWebhookConfig(authUser.userId, {
      delivery_channel: body.delivery_channel ?? "custom",
      endpoint_url: body.endpoint_url ?? null,
      telegram_bot_token: body.telegram_bot_token ?? null,
      telegram_chat_id: body.telegram_chat_id ?? null,
      webhook_events: body.webhook_events ?? ["*"],
    });
    return {
      delivery_channel: agent.delivery_channel,
      endpoint_url: agent.endpoint_url,
      telegram_bot_token: null,
      telegram_chat_id: agent.telegram_chat_id,
      webhook_events: agent.webhook_events,
    };
  }),
);

openClawRouter.post("/openclaw/agent/webhook-test", requireAuth(), async (c) =>
  withJson(c, async () => {
    const authUser = c.get("authUser") as { userId: string };
    return openclaw.sendWebhookTest(authUser.userId);
  }),
);

openClawRouter.get("/openclaw/api-keys", requireAuth(), async (c) =>
  withJson(c, async () => {
    const authUser = c.get("authUser") as { userId: string };
    return {
      keys: await openclaw.listApiKeysForCurrentAgent(authUser.userId),
    };
  }),
);

openClawRouter.post("/openclaw/api-keys", requireAuth(), async (c) =>
  withJson(c, async () => {
    const authUser = c.get("authUser") as { userId: string };
    const current = await openclaw.getCurrentAgent(authUser.userId);
    if (!current) {
      throw createError("No imported OpenClaw agent found", 404);
    }
    const body = schemas.openClawApiKeyCreateSchema.parse(await c.req.json().catch(() => ({})));
    return openclaw.createApiKey(current.id, authUser.userId, body.scopes);
  }),
);

openClawRouter.post("/openclaw/api-keys/:id/rotate", requireAuth(), async (c) =>
  withJson(c, async () => {
    const authUser = c.get("authUser") as { userId: string };
    return openclaw.rotateApiKey(authUser.userId, c.req.param("id"));
  }),
);

openClawRouter.delete("/openclaw/api-keys/:id", requireAuth(), async (c) =>
  withJson(c, async () => {
    const authUser = c.get("authUser") as { userId: string };
    return openclaw.revokeApiKey(authUser.userId, c.req.param("id"));
  }),
);

// =============================================================================
// Public claim + docs
// =============================================================================

openClawRouter.get("/openclaw/claim/:token", async (c) =>
  withJson(c, async () => {
    const apiBase = getApiBaseFromRequest(c.req.raw);
    return {
      ...buildOpenClawSkillJson(apiBase),
      claim_url: `${apiBase}/openclaw/claim/${c.req.param("token")}`,
      message: "Read this handshake document, then POST your identity payload back to the same URL.",
    };
  }),
);

openClawRouter.post("/openclaw/claim/:token", async (c) =>
  withJson(c, async () => {
    const body = schemas.openClawClaimSchema.parse(await c.req.json());
    const apiBase = getApiBaseFromRequest(c.req.raw);
    const result = await openclaw.claimOnboardingSession(c.req.param("token"), {
      name: body.name,
      description: body.description ?? null,
      agent_url: body.agent_url,
      endpoint_url: body.endpoint_url ?? null,
      webhook_events: body.webhook_events,
    });

    return {
      ...result.credentials,
      api_base_url: `${apiBase}/openclaw/tools`,
      skill_manifest_url: `${apiBase}/openclaw/skill.md`,
      skill_json_url: `${apiBase}/openclaw/skill.json`,
      heartbeat_url: `${apiBase}/openclaw/tools/heartbeat`,
      session: result.session,
      agent: result.agent,
    };
  }),
);

openClawRouter.get("/openclaw/skill.md", (c) => {
  const apiBase = getApiBaseFromRequest(c.req.raw);
  return c.text(buildOpenClawSkillMarkdown(apiBase), 200, {
    "Content-Type": "text/markdown; charset=utf-8",
  });
});

openClawRouter.get("/openclaw/docs", (c) => {
  const apiBase = getApiBaseFromRequest(c.req.raw);
  return c.text(buildOpenClawSkillMarkdown(apiBase), 200, {
    "Content-Type": "text/markdown; charset=utf-8",
  });
});

openClawRouter.get("/openclaw/skill.json", (c) => {
  const apiBase = getApiBaseFromRequest(c.req.raw);
  return c.json(buildOpenClawSkillJson(apiBase));
});

openClawRouter.get("/openclaw/docs-metadata", requireAuth(), async (c) =>
  withJson(c, async () => {
    const apiBase = getApiBaseFromRequest(c.req.raw);
    return openclaw.buildDocsMetadata(apiBase);
  }),
);

// =============================================================================
// API-key tool bridge
// =============================================================================

openClawRouter.get("/openclaw/tools/profile", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const profile = await users.getUserProfile(apiKey.user_id);
    if (!profile) {
      throw createError("User profile not found", 404);
    }
    return profile;
  }),
);

openClawRouter.put("/openclaw/tools/profile", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const body = schemas.updateMyProfileSchema.parse(await c.req.json());
    return users.updateUserProfile(apiKey.user_id, body);
  }),
);

openClawRouter.get("/openclaw/tools/boilerplates", async (c) =>
  withJson(c, async () => boilerplates.listBoilerplates()),
);

openClawRouter.get("/openclaw/tools/boilerplates/:slug", async (c) =>
  withJson(c, async () => {
    const boilerplate = await boilerplates.getBoilerplate(c.req.param("slug"));
    if (!boilerplate) throw createError("Boilerplate not found", 404);
    return boilerplate;
  }),
);

openClawRouter.get("/openclaw/tools/registry/externals", async (c) =>
  withJson(c, async () => externals.listRegistry()),
);

openClawRouter.get("/openclaw/tools/games", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    return games.listGamesByUser(apiKey.user_id);
  }),
);

openClawRouter.post("/openclaw/tools/games", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const body = toolCreateGameSchema.parse(await c.req.json());
    await ensureProfile(apiKey.user_id);
    return games.createGame(
      body.name,
      body.description,
      apiKey.user_id,
      body.genre,
      body.game_format,
    );
  }),
);

openClawRouter.get("/openclaw/tools/games/:name", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const owned = await ensureOwnedGame(apiKey.user_id, c.req.param("name"));
    const game = await games.getGame(owned.name);
    if (!game) throw createError("Game not found", 404);
    return game;
  }),
);

openClawRouter.get("/openclaw/tools/games/:name/structure", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const owned = await ensureOwnedGame(apiKey.user_id, c.req.param("name"));
    const typeFilter = c.req.query("type") || undefined;
    return atoms.getCodeStructure(owned.id, typeFilter);
  }),
);

openClawRouter.post("/openclaw/tools/games/:name/atoms/read", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const owned = await ensureOwnedGame(apiKey.user_id, c.req.param("name"));
    const body = toolReadAtomsSchema.parse(await c.req.json());
    return atoms.readAtoms(owned.id, body.names);
  }),
);

openClawRouter.post("/openclaw/tools/games/:name/atoms/search", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const owned = await ensureOwnedGame(apiKey.user_id, c.req.param("name"));
    const body = toolSearchAtomsSchema.parse(await c.req.json());
    return atoms.semanticSearch(owned.id, body.query, body.limit);
  }),
);

openClawRouter.put("/openclaw/tools/games/:name/atoms/:atom_name", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const owned = await ensureOwnedGame(apiKey.user_id, c.req.param("name"));
    const body = schemas.upsertAtomSchema.parse(await c.req.json());
    return atoms.upsertAtom(owned.id, {
      name: c.req.param("atom_name"),
      code: body.code,
      type: body.type,
      inputs: body.inputs,
      outputs: body.outputs,
      dependencies: body.dependencies,
      description: body.description,
    });
  }),
);

openClawRouter.delete("/openclaw/tools/games/:name/atoms/:atom_name", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const owned = await ensureOwnedGame(apiKey.user_id, c.req.param("name"));
    await atoms.deleteAtom(owned.id, c.req.param("atom_name"));
    return { ok: true };
  }),
);

openClawRouter.get("/openclaw/tools/games/:name/externals", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const owned = await ensureOwnedGame(apiKey.user_id, c.req.param("name"));
    return externals.getInstalledExternals(owned.id);
  }),
);

openClawRouter.post("/openclaw/tools/games/:name/externals", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const owned = await ensureOwnedGame(apiKey.user_id, c.req.param("name"));
    const body = schemas.installExternalSchema.parse(await c.req.json());
    return externals.installExternal(owned.id, body.name);
  }),
);

openClawRouter.delete("/openclaw/tools/games/:name/externals/:ext_name", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const owned = await ensureOwnedGame(apiKey.user_id, c.req.param("name"));
    await externals.uninstallExternal(owned.id, c.req.param("ext_name"));
    return { ok: true };
  }),
);

openClawRouter.get("/openclaw/tools/games/:name/builds", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const owned = await ensureOwnedGame(apiKey.user_id, c.req.param("name"));
    const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);
    return builds.listBuilds(owned.id, limit);
  }),
);

openClawRouter.post("/openclaw/tools/games/:name/builds", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const owned = await ensureOwnedGame(apiKey.user_id, c.req.param("name"));
    await atoms.triggerRebuild(owned.id);
    return { status: "rebuild triggered", game_id: owned.id };
  }),
);

openClawRouter.post("/openclaw/tools/games/:name/builds/:id/rollback", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const owned = await ensureOwnedGame(apiKey.user_id, c.req.param("name"));
    return builds.rollbackBuild(owned.id, c.req.param("id"));
  }),
);

openClawRouter.post("/openclaw/tools/games/:name/publish", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const owned = await ensureOwnedGame(apiKey.user_id, c.req.param("name"));
    const body = schemas.publishGameSchema.parse(await c.req.json());
    return games.publishGame(owned.id, body.slug.trim());
  }),
);

openClawRouter.post("/openclaw/tools/games/:name/unpublish", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const owned = await ensureOwnedGame(apiKey.user_id, c.req.param("name"));
    return games.unpublishGame(owned.id);
  }),
);

openClawRouter.put("/openclaw/tools/games/:name/token", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const owned = await ensureOwnedGame(apiKey.user_id, c.req.param("name"));
    const body = toolTokenSchema.parse(await c.req.json());
    return tokens.upsertTokenLaunch(
      owned.id,
      apiKey.user_id,
      body.token_name,
      body.token_symbol,
      {
        chainId: body.chain_id,
        totalSupply: body.total_supply,
        leaderboardAllocationPct: body.leaderboard_allocation_pct,
      },
    );
  }),
);

openClawRouter.get("/openclaw/tools/games/:name/token", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const owned = await ensureOwnedGame(apiKey.user_id, c.req.param("name"));
    const launch = await tokens.getTokenLaunch(owned.id);
    if (!launch) throw createError("No token launch found", 404);
    return launch;
  }),
);

openClawRouter.get("/openclaw/tools/games/:name/token/distributions", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const owned = await ensureOwnedGame(apiKey.user_id, c.req.param("name"));
    const launch = await tokens.getTokenLaunch(owned.id);
    if (!launch) throw createError("No token launch found", 404);
    return tokens.getDistributions(launch.id);
  }),
);

openClawRouter.get("/openclaw/tools/games/:name/chat/sessions", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const owned = await ensureOwnedGame(apiKey.user_id, c.req.param("name"));
    const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);
    return chat.listSessions(owned.id, limit);
  }),
);

openClawRouter.post("/openclaw/tools/games/:name/chat/sessions", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const owned = await ensureOwnedGame(apiKey.user_id, c.req.param("name"));
    const body = toolCreateChatSessionSchema.parse(await c.req.json());
    return chat.createSession(owned.id, body.model, body.title);
  }),
);

openClawRouter.delete("/openclaw/tools/games/:name/chat/sessions/:sessionId", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    await ensureOwnedSession(apiKey.user_id, c.req.param("name"), c.req.param("sessionId"));
    await chat.deleteSession(c.req.param("sessionId"));
    return { ok: true };
  }),
);

openClawRouter.get("/openclaw/tools/games/:name/chat/sessions/:sessionId/messages", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    await ensureOwnedSession(apiKey.user_id, c.req.param("name"), c.req.param("sessionId"));
    return chat.getMessages(c.req.param("sessionId"));
  }),
);

openClawRouter.post("/openclaw/tools/games/:name/chat/sessions/:sessionId/messages", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    await ensureOwnedSession(apiKey.user_id, c.req.param("name"), c.req.param("sessionId"));
    const body = toolSaveMessagesSchema.parse(await c.req.json());
    await chat.saveMessages(c.req.param("sessionId"), body.messages);
    return { ok: true };
  }),
);

openClawRouter.post("/openclaw/tools/games/:name/warrooms", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const owned = await ensureOwnedGame(apiKey.user_id, c.req.param("name"));
    const body = toolCreateWarRoomSchema.parse(await c.req.json());
    const room = await warrooms.createWarRoom(
      owned.id,
      apiKey.user_id,
      body.prompt,
      body.genre ?? owned.genre,
      owned.game_format,
    );
    return room;
  }),
);

openClawRouter.get("/openclaw/tools/games/:name/warrooms", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const owned = await ensureOwnedGame(apiKey.user_id, c.req.param("name"));
    const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);
    return warrooms.listWarRooms(owned.id, limit);
  }),
);

openClawRouter.get("/openclaw/tools/games/:name/warrooms/:id", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    await ensureOwnedWarRoom(apiKey.user_id, c.req.param("name"), c.req.param("id"));
    const room = await warrooms.getWarRoomFeed(c.req.param("id"));
    if (!room) throw createError("War room not found", 404);
    return room;
  }),
);

openClawRouter.post("/openclaw/tools/games/:name/warrooms/:id/cancel", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    await ensureOwnedWarRoom(apiKey.user_id, c.req.param("name"), c.req.param("id"));
    const room = await warrooms.updateWarRoomStatus(c.req.param("id"), "cancelled");
    return room;
  }),
);

openClawRouter.get("/openclaw/tools/platform-health", async (c) =>
  withJson(c, async () => openclaw.getPlatformHealth()),
);

openClawRouter.get("/openclaw/tools/agent-status", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const health = await openclaw.computeOpenClawHealthScore(apiKey.user_id);
    return {
      agent: await openclaw.getCurrentAgent(apiKey.user_id),
      health,
    };
  }),
);

openClawRouter.get("/openclaw/tools/health-score", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const score = await openclaw.computeOpenClawHealthScore(apiKey.user_id);
    if (!score) throw createError("No imported OpenClaw agent found", 404);
    return score;
  }),
);

openClawRouter.post("/openclaw/tools/heartbeat", async (c) =>
  withJson(c, async () => {
    const apiKey = c.get("openclawApiKey") as openclaw.OpenClawApiKeyContext;
    const body = schemas.openClawHeartbeatSchema.parse(await c.req.json().catch(() => ({})));
    const agent = await openclaw.recordHeartbeat(apiKey.agent_id, body.metadata);
    return {
      connection_status: agent.connection_status,
      last_heartbeat: agent.last_heartbeat,
    };
  }),
);
