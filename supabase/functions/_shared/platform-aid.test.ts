import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "jsr:@std/assert@1";
import {
  buildPlatformAidArtifacts,
  humanizePlatformAidReply,
  type PlatformAidLiveContext,
} from "./platform-aid.ts";

function makeContext(
  overrides: Partial<PlatformAidLiveContext>,
): PlatformAidLiveContext {
  return {
    account: {
      displayName: "Carlos",
      email: "carlos@example.com",
      walletAddress: null,
    },
    games: {
      totalCount: 0,
      publishedCount: 0,
      latestGame: null,
    },
    route: {
      pageId: "dashboard",
      label: "Dashboard",
      summary: "Overview of creations, stats, and next steps.",
    },
    ...overrides,
  };
}

Deno.test("humanizer removes canned openers and keeps the reply under 60 words", () => {
  const reply = humanizePlatformAidReply(
    "Great question. It is important to note that the dashboard showcases your creations and additionally helps you understand what to do next in the platform.",
  );

  assert(!reply.toLowerCase().startsWith("great question"));
  assert(reply.split(/\s+/).length <= 60);
  assert(/[.!?]$/.test(reply));
});

Deno.test("no-games onboarding prefers create flow actions", () => {
  const artifacts = buildPlatformAidArtifacts({
    message: "How do I get started?",
    history: [],
    context: makeContext({}),
  });

  assertEquals(artifacts.actions[0], {
    label: "Create Game",
    href: "/dashboard?aid=create",
  });
  assertStringIncludes(artifacts.fallbackReply, "/dashboard");
  assert(artifacts.suggestions.length > 0);
});

Deno.test("unpublished games prefer library and latest-game actions", () => {
  const artifacts = buildPlatformAidArtifacts({
    message: "How do I publish this?",
    history: [],
    context: makeContext({
      games: {
        totalCount: 2,
        publishedCount: 0,
        latestGame: {
          name: "Meteor Rush",
          href: "/games/Meteor%20Rush",
          updatedAt: "2026-03-10T10:00:00.000Z",
          buildStatus: "success",
          isPublished: false,
        },
      },
    }),
  });

  assertEquals(artifacts.actions[0], {
    label: "Open Meteor Rush",
    href: "/games/Meteor%20Rush",
  });
  assertEquals(artifacts.actions[1], {
    label: "Open Library",
    href: "/library",
  });
});

Deno.test("openclaw without an agent prioritizes docs and import guidance", () => {
  const artifacts = buildPlatformAidArtifacts({
    message: "How do I import OpenClaw?",
    history: [],
    context: makeContext({
      route: {
        pageId: "openclaw",
        label: "OpenClaw",
        summary: "Import, manage, and monitor an OpenClaw agent.",
      },
      openclaw: {
        hasAgent: false,
        agentName: null,
        connectionStatus: null,
        healthStatus: null,
        healthScore: null,
        docsHref: "/openclaw/docs",
      },
    }),
  });

  assertEquals(artifacts.actions[0], {
    label: "Open OpenClaw",
    href: "/openclaw",
  });
  assertEquals(artifacts.actions[1], {
    label: "Open Docs",
    href: "/openclaw/docs",
  });
  assertStringIncludes(artifacts.fallbackReply, "claim");
});

Deno.test("openclaw with a connected agent suggests health and connection follow-ups", () => {
  const artifacts = buildPlatformAidArtifacts({
    message: "What does the health score mean?",
    history: [],
    context: makeContext({
      route: {
        pageId: "openclaw",
        label: "OpenClaw",
        summary: "Import, manage, and monitor an OpenClaw agent.",
      },
      games: {
        totalCount: 1,
        publishedCount: 1,
        latestGame: {
          name: "Meteor Rush",
          href: "/games/Meteor%20Rush",
          updatedAt: "2026-03-10T10:00:00.000Z",
          buildStatus: "success",
          isPublished: true,
        },
      },
      openclaw: {
        hasAgent: true,
        agentName: "OpenClaw",
        connectionStatus: "connected",
        healthStatus: "healthy",
        healthScore: 92,
        docsHref: "/openclaw/docs",
      },
    }),
  });

  assert(artifacts.suggestions.some((item) => item.includes("connection test")));
  assertEquals(artifacts.actions[0], {
    label: "Open OpenClaw",
    href: "/openclaw",
  });
});

Deno.test("off-topic prompts redirect back to the platform scope", () => {
  const artifacts = buildPlatformAidArtifacts({
    message: "What's the weather in Barcelona?",
    history: [],
    context: makeContext({}),
  });

  assertEquals(artifacts.offTopic, true);
  assertStringIncludes(artifacts.fallbackReply, "Atomic Game Maker");
});
