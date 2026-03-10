export type ArchitectureHandle = "top" | "right" | "bottom" | "left";
export type ArchitectureNodeKind = "platform" | "agent" | "service";
export type ArchitectureAgentId = "jarvis" | "forge" | "pixel" | "checker";
export type ArchitectureServiceCategory =
  | "tool"
  | "runtime"
  | "model"
  | "integration";

export interface ArchitecturePosition {
  x: number;
  y: number;
}

export interface ArchitectureRuntimeSurface {
  label: string;
  detail: string;
}

export interface PlatformNodeDefinition {
  id: "platform";
  kind: "platform";
  position: ArchitecturePosition;
  label: string;
  description: string;
  iconSrc: string;
  runtimeSurfaces: ArchitectureRuntimeSurface[];
  connectedAgentIds: ArchitectureAgentId[];
}

export interface AgentNodeDefinition {
  id: ArchitectureAgentId;
  kind: "agent";
  position: ArchitecturePosition;
  label: string;
  accentColor: string;
  role: string;
  description: string;
  model: string;
  toolAccess: string[];
  skills: string[];
  ownedTasks: string[];
  serviceIds: string[];
}

export interface ServiceNodeDefinition {
  id: string;
  kind: "service";
  position: ArchitecturePosition;
  label: string;
  icon: string;
  category: ArchitectureServiceCategory;
  parentAgentId: ArchitectureAgentId;
  runtimeType: string;
  description: string;
  notes: string[];
  edgeIntensity?: "medium" | "low";
}

export type ArchitectureNodeDefinition =
  | PlatformNodeDefinition
  | AgentNodeDefinition
  | ServiceNodeDefinition;

export interface ArchitectureEdgeDefinition {
  id: string;
  source: string;
  target: string;
  sourceHandle: `source-${ArchitectureHandle}`;
  targetHandle: `target-${ArchitectureHandle}`;
  intensity: "high" | "medium" | "low";
  color: string;
}

export interface ArchitectureGraphDefinition {
  nodes: ArchitectureNodeDefinition[];
  edges: ArchitectureEdgeDefinition[];
}

interface ServiceTemplate {
  id: string;
  label: string;
  icon: string;
  category: ArchitectureServiceCategory;
  runtimeType: string;
  description: string;
  notes: string[];
  edgeIntensity?: "medium" | "low";
}

const CENTER = { x: 760, y: 520 };
const AGENT_RADIUS = 360;
const SERVICE_RADIUS = 250;

const AGENT_ANGLES: Record<ArchitectureAgentId, number> = {
  jarvis: -90,
  forge: -8,
  pixel: 95,
  checker: 188,
};

const PLATFORM_RUNTIME_SURFACES: ArchitectureRuntimeSurface[] = [
  {
    label: "Next.js Web App",
    detail: "Primary control plane for dashboard, workspace, chat, and public play routes.",
  },
  {
    label: "Mastra Service",
    detail: "Hosts Jarvis, Forge, Pixel, and Checker for chat streaming and pipeline execution.",
  },
  {
    label: "Supabase Core",
    detail: "Postgres, Edge Functions, Realtime, and Storage remain the durable system boundary.",
  },
  {
    label: "Privy Auth",
    detail: "Protected app routes depend on Privy identity and bearer-token verification.",
  },
  {
    label: "OpenRouter + buu.fun",
    detail: "OpenRouter powers language and image generation; buu.fun backs generated 3D assets.",
  },
  {
    label: "Upstash + Observability",
    detail: "Redis/QStash support delivery and rate limits while Sentry and Axiom track failures.",
  },
];

const AGENT_META: Record<
  ArchitectureAgentId,
  Omit<AgentNodeDefinition, "kind" | "position" | "serviceIds">
> = {
  jarvis: {
    id: "jarvis",
    label: "Jarvis",
    accentColor: "#e879f9",
    role: "Orchestrator, scope parser, delivery aggregator",
    description:
      "Jarvis owns intake and closeout. It plans the work, coordinates the task graph, and turns pipeline output into next actions.",
    model: "openrouter/anthropic/claude-sonnet-4.6",
    toolAccess: [
      "get-code-structure",
      "read-atoms",
      "upsert-atom",
    ],
    skills: [
      "scope-intake",
      "task-graph orchestration",
      "delivery synthesis",
      "retry-and-follow-up planning",
    ],
    ownedTasks: [
      "#1 Parse scope & plan",
      "#12 Deliver & suggest prompts",
    ],
  },
  forge: {
    id: "forge",
    label: "Forge",
    accentColor: "#38bdf8",
    role: "Primary implementation agent for atom creation and repair",
    description:
      "Forge handles the heavy code-writing path: boilerplate loading, bottom-up atom composition, and repair after validation failures.",
    model: "openrouter/anthropic/claude-sonnet-4.6",
    toolAccess: [
      "get-code-structure",
      "read-atoms",
      "upsert-atom",
    ],
    skills: [
      "genre-boilerplate loading",
      "atom decomposition and upsert",
      "dependency-aware composition",
      "validation-driven repair",
    ],
    ownedTasks: [
      "#2 Load genre boilerplate",
      "#4 Implement util atoms",
      "#5 Implement feature atoms",
      "#6 Implement core atoms",
      "#10 Fix failures",
    ],
  },
  pixel: {
    id: "pixel",
    label: "Pixel",
    accentColor: "#34d399",
    role: "Visual design system and asset generation specialist",
    description:
      "Pixel translates scope into a cohesive design system, then generates polished UI packs, sprites, textures, and overlays.",
    model: "openrouter/anthropic/claude-sonnet-4.6",
    toolAccess: [
      "get-code-structure",
      "read-atoms",
      "generate-polished-visual-pack",
    ],
    skills: [
      "art-direction extraction",
      "HUD/UI asset generation",
      "sprite-texture generation",
      "asset packaging and publishing",
    ],
    ownedTasks: [
      "#7 Generate UI assets",
      "#8 Generate game sprites",
    ],
  },
  checker: {
    id: "checker",
    label: "Checker",
    accentColor: "#fbbf24",
    role: "Validation author, QA gate, and regression auditor",
    description:
      "Checker stays read-only and enforces structure, score-system compliance, and final regression confidence before delivery.",
    model: "openrouter/google/gemini-2.5-pro-preview-06-05",
    toolAccess: [
      "get-code-structure",
      "read-atoms",
    ],
    skills: [
      "validation-spec authoring",
      "structural-and-score compliance audit",
      "runtime test generation",
      "regression triage and gatekeeping",
    ],
    ownedTasks: [
      "#3 Write validation specs",
      "#9 Run validation suite",
      "#11 Final validation",
    ],
  },
};

const AGENT_SERVICES: Record<ArchitectureAgentId, ServiceTemplate[]> = {
  jarvis: [
    {
      id: "jarvis-orchestrator",
      label: "Task Graph Orchestrator",
      icon: "JG",
      category: "runtime",
      runtimeType: "Mastra orchestration runtime",
      description:
        "Coordinates prompt analysis, pipeline planning, delivery synthesis, and follow-up prompt generation.",
      notes: [
        "Matches Jarvis' live role in the Mastra agent config.",
        "Owns the first and last fixed pipeline tasks.",
      ],
      edgeIntensity: "medium",
    },
    {
      id: "jarvis-supabase-tools",
      label: "Supabase Toolchain",
      icon: "DB",
      category: "tool",
      runtimeType: "get-code-structure • read-atoms • upsert-atom",
      description:
        "Jarvis can inspect and modify atoms through the local Supabase tool layer used by Mastra.",
      notes: [
        "Tools are defined in mastra/src/tools/supabase.ts.",
        "Upsert access exists even though Jarvis is primarily orchestration-focused.",
      ],
      edgeIntensity: "medium",
    },
    {
      id: "jarvis-claude-model",
      label: "Claude Sonnet 4.6",
      icon: "AI",
      category: "model",
      runtimeType: "openrouter/anthropic/claude-sonnet-4.6",
      description:
        "Jarvis runs on Claude Sonnet 4.6 for planning, scope analysis, and high-level delivery output.",
      notes: [
        "Configured directly in mastra/src/agents/jarvis.ts.",
      ],
      edgeIntensity: "low",
    },
  ],
  forge: [
    {
      id: "forge-code-reader",
      label: "Code Structure Reader",
      icon: "RG",
      category: "tool",
      runtimeType: "get-code-structure • read-atoms",
      description:
        "Forge inspects existing atoms before making changes so it can follow the intended dependency order.",
      notes: [
        "The agent instructions explicitly require reading existing atoms first.",
      ],
      edgeIntensity: "medium",
    },
    {
      id: "forge-atom-upsert",
      label: "Atom Upsert",
      icon: "{}",
      category: "tool",
      runtimeType: "upsert-atom",
      description:
        "Creates or updates atoms in Supabase with size validation, interface metadata, and dependency rewrites.",
      notes: [
        "The upsert path enforces the 2 KB atom limit before persistence.",
      ],
      edgeIntensity: "medium",
    },
    {
      id: "forge-rebuild-trigger",
      label: "Bundle Rebuild Trigger",
      icon: "RB",
      category: "integration",
      runtimeType: "Supabase Edge Function: rebuild-bundle",
      description:
        "The shared upsert tool can trigger the rebuild-bundle Edge Function after atom mutations.",
      notes: [
        "Pipeline mode can skip rebuilds so the orchestrator controls final publishing timing.",
      ],
      edgeIntensity: "low",
    },
    {
      id: "forge-claude-model",
      label: "Claude Sonnet 4.6",
      icon: "AI",
      category: "model",
      runtimeType: "openrouter/anthropic/claude-sonnet-4.6",
      description:
        "Forge uses Claude Sonnet 4.6 as the reasoning model behind the write-heavy implementation path.",
      notes: [
        "Configured directly in mastra/src/agents/forge.ts.",
      ],
      edgeIntensity: "low",
    },
  ],
  pixel: [
    {
      id: "pixel-context-readers",
      label: "Code Context Readers",
      icon: "CTX",
      category: "tool",
      runtimeType: "get-code-structure • read-atoms",
      description:
        "Pixel reads gameplay structure and scope before generating visuals so art direction matches mechanics.",
      notes: [
        "The Pixel system prompt requires code inspection before asset generation.",
      ],
      edgeIntensity: "medium",
    },
    {
      id: "pixel-visual-pack",
      label: "generate-polished-visual-pack",
      icon: "PK",
      category: "tool",
      runtimeType: "Pixel tool bundle",
      description:
        "Batch generator for HUD, menu, overlay, sprite, texture, and icon packs with polish goals and reference notes.",
      notes: [
        "Defined in mastra/src/tools/pixel.ts.",
        "Every generated asset path goes through this tool in the current Pixel contract.",
      ],
      edgeIntensity: "medium",
    },
    {
      id: "pixel-openrouter-api",
      label: "OpenRouter Image API",
      icon: "OR",
      category: "integration",
      runtimeType: "chat/completions with image modalities",
      description:
        "Pixel calls OpenRouter directly for multimodal image generation and asset pack output.",
      notes: [
        "The request carries image modality plus aspect ratio and image size settings.",
      ],
      edgeIntensity: "medium",
    },
    {
      id: "pixel-image-model",
      label: "Gemini 3.1 Flash Image Preview",
      icon: "IMG",
      category: "model",
      runtimeType: "google/gemini-3.1-flash-image-preview",
      description:
        "Default OpenRouter image model used by Pixel for polished UI packs, sprites, and texture generation.",
      notes: [
        "The model is configurable through OPENROUTER_IMAGE_MODEL.",
      ],
      edgeIntensity: "low",
    },
  ],
  checker: [
    {
      id: "checker-readonly-tools",
      label: "Read-only Code Readers",
      icon: "RO",
      category: "tool",
      runtimeType: "get-code-structure • read-atoms",
      description:
        "Checker only inspects atoms and never writes, which keeps the validation boundary clean and auditable.",
      notes: [
        "Configured with read-only access in mastra/src/agents/checker.ts.",
      ],
      edgeIntensity: "medium",
    },
    {
      id: "checker-structural-validation",
      label: "Structural Validation",
      icon: "QA",
      category: "runtime",
      runtimeType: "size • naming • interfaces • DAG integrity",
      description:
        "Enforces atom-size limits, snake_case naming, primitive-only interfaces, and dependency graph correctness.",
      notes: [
        "These rules live in checker instructions and deterministic validation utilities.",
      ],
      edgeIntensity: "medium",
    },
    {
      id: "checker-score-audit",
      label: "Score Compliance Audit",
      icon: "SC",
      category: "runtime",
      runtimeType: "score_tracker • SCORE_UPDATE wiring",
      description:
        "Checks that gameplay still emits score updates and remains compatible with leaderboard expectations.",
      notes: [
        "Score compliance is explicitly called out in the Checker contract and shared validators.",
      ],
      edgeIntensity: "medium",
    },
    {
      id: "checker-gemini-model",
      label: "Gemini 2.5 Pro Preview",
      icon: "AI",
      category: "model",
      runtimeType: "openrouter/google/gemini-2.5-pro-preview-06-05",
      description:
        "Checker runs on Gemini 2.5 Pro Preview for read-only QA and validation reporting.",
      notes: [
        "Configured directly in mastra/src/agents/checker.ts.",
      ],
      edgeIntensity: "low",
    },
  ],
};

function polarToXY(
  cx: number,
  cy: number,
  angle: number,
  radius: number,
): ArchitecturePosition {
  const radians = (angle * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function pickSide(from: ArchitecturePosition, to: ArchitecturePosition): ArchitectureHandle {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "bottom" : "top";
}

function buildEdge(
  source: ArchitectureNodeDefinition,
  target: ArchitectureNodeDefinition,
  intensity: "high" | "medium" | "low",
  color: string,
): ArchitectureEdgeDefinition {
  const sourceSide = pickSide(source.position, target.position);
  const targetSide = pickSide(target.position, source.position);

  return {
    id: `${source.id}-${target.id}`,
    source: source.id,
    target: target.id,
    sourceHandle: `source-${sourceSide}`,
    targetHandle: `target-${targetSide}`,
    intensity,
    color,
  };
}

export const ARCHITECTURE_AGENT_IDS = Object.keys(
  AGENT_META,
) as ArchitectureAgentId[];

export const ARCHITECTURE_AGENT_COUNT = ARCHITECTURE_AGENT_IDS.length;
export const ARCHITECTURE_SERVICE_COUNT = Object.values(AGENT_SERVICES).reduce(
  (count, services) => count + services.length,
  0,
);

export function buildArchitectureGraph(): ArchitectureGraphDefinition {
  const platformNode: PlatformNodeDefinition = {
    id: "platform",
    kind: "platform",
    position: { x: CENTER.x - 110, y: CENTER.y - 110 },
    label: "Atomic Game Maker",
    description:
      "AI-native game development platform built around atom storage, multi-agent orchestration, realtime progress, and generated asset pipelines.",
    iconSrc: "/favicon.ico",
    runtimeSurfaces: PLATFORM_RUNTIME_SURFACES,
    connectedAgentIds: ARCHITECTURE_AGENT_IDS,
  };

  const nodes: ArchitectureNodeDefinition[] = [platformNode];
  const edges: ArchitectureEdgeDefinition[] = [];
  const agentNodes = new Map<ArchitectureAgentId, AgentNodeDefinition>();

  for (const agentId of ARCHITECTURE_AGENT_IDS) {
    const meta = AGENT_META[agentId];
    const agentPosition = polarToXY(
      CENTER.x,
      CENTER.y,
      AGENT_ANGLES[agentId],
      AGENT_RADIUS,
    );
    const services = AGENT_SERVICES[agentId];

    const agentNode: AgentNodeDefinition = {
      ...meta,
      kind: "agent",
      position: { x: agentPosition.x - 90, y: agentPosition.y - 56 },
      serviceIds: services.map((service) => service.id),
    };

    nodes.push(agentNode);
    agentNodes.set(agentId, agentNode);
    edges.push(buildEdge(platformNode, agentNode, "high", meta.accentColor));

    const fanSpread = Math.min(46, 120 / Math.max(services.length - 1, 1));
    const startAngle = AGENT_ANGLES[agentId] - (fanSpread * (services.length - 1)) / 2;

    services.forEach((service, index) => {
      const servicePosition = polarToXY(
        agentPosition.x,
        agentPosition.y,
        startAngle + index * fanSpread,
        SERVICE_RADIUS,
      );
      const serviceNode: ServiceNodeDefinition = {
        ...service,
        kind: "service",
        parentAgentId: agentId,
        position: { x: servicePosition.x - 74, y: servicePosition.y - 32 },
      };

      nodes.push(serviceNode);
      edges.push(
        buildEdge(
          agentNode,
          serviceNode,
          service.edgeIntensity ?? "low",
          meta.accentColor,
        ),
      );
    });
  }

  return { nodes, edges };
}

export function getArchitectureNodeById(
  nodeId: string,
): ArchitectureNodeDefinition | undefined {
  const graph = buildArchitectureGraph();
  return graph.nodes.find((node) => node.id === nodeId);
}

