"use client";

import { useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { LastEditedGame } from "@/lib/analytics";
import {
  ARCHITECTURE_AGENT_COUNT,
  ARCHITECTURE_SERVICE_COUNT,
  buildArchitectureGraph,
  type AgentNodeDefinition,
  type InfrastructureNodeDefinition,
  type PlatformNodeDefinition,
  type ServiceNodeDefinition,
} from "../data/architectureData";

interface RelatedNodeLink {
  id: string;
  label: string;
}

export interface PlatformNodeData
  extends Omit<PlatformNodeDefinition, "kind" | "position" | "connectedAgentIds"> {
  type: "platform";
  connectedAgents: RelatedNodeLink[];
  counts: {
    agents: number;
    services: number;
  };
  lastEditedGame: LastEditedGame | null;
  lastEditedGameLabel: string | null;
  [key: string]: unknown;
}

export interface AgentNodeData
  extends Omit<AgentNodeDefinition, "kind" | "position" | "serviceIds"> {
  type: "agent";
  services: RelatedNodeLink[];
  [key: string]: unknown;
}

export interface ServiceNodeData
  extends Omit<ServiceNodeDefinition, "kind" | "position" | "parentAgentId"> {
  type: "service";
  owner: RelatedNodeLink;
  [key: string]: unknown;
}

export interface InfrastructureNodeData
  extends Omit<InfrastructureNodeDefinition, "kind" | "position" | "connectedNodeIds"> {
  type: "infrastructure";
  connectedNodes: RelatedNodeLink[];
  [key: string]: unknown;
}

export type ArchitectureNodeData =
  | PlatformNodeData
  | AgentNodeData
  | ServiceNodeData
  | InfrastructureNodeData;

export interface ArchitectureEdgeData {
  intensity: "high" | "medium" | "low";
  color: string;
  [key: string]: unknown;
}

export type ArchitectureFlowNode = Node<ArchitectureNodeData>;
export type ArchitectureFlowEdge = Edge<ArchitectureEdgeData>;

function formatLastEditedGameLabel(game: LastEditedGame | null): string | null {
  if (!game) return null;
  return game.genre ? `${game.name} · ${game.genre}` : game.name;
}

export function useArchitectureState(lastEditedGame: LastEditedGame | null): {
  nodes: ArchitectureFlowNode[];
  edges: ArchitectureFlowEdge[];
} {
  return useMemo(() => {
    const graph = buildArchitectureGraph();
    const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));

    const nodes: ArchitectureFlowNode[] = graph.nodes.map((node) => {
      if (node.kind === "platform") {
        const data: PlatformNodeData = {
          ...node,
          type: "platform",
          connectedAgents: node.connectedAgentIds
            .map((id) => nodeMap.get(id))
            .filter((value): value is AgentNodeDefinition => value?.kind === "agent")
            .map((agent) => ({ id: agent.id, label: agent.label })),
          counts: {
            agents: ARCHITECTURE_AGENT_COUNT,
            services: ARCHITECTURE_SERVICE_COUNT,
          },
          lastEditedGame,
          lastEditedGameLabel: formatLastEditedGameLabel(lastEditedGame),
        };

        return {
          id: node.id,
          type: "platformNode",
          position: node.position,
          data,
          draggable: true,
        };
      }

      if (node.kind === "agent") {
        const data: AgentNodeData = {
          ...node,
          type: "agent",
          services: node.serviceIds
            .map((id) => nodeMap.get(id))
            .filter((value): value is ServiceNodeDefinition => value?.kind === "service")
            .map((service) => ({ id: service.id, label: service.label })),
        };

        return {
          id: node.id,
          type: "agentNode",
          position: node.position,
          data,
          draggable: true,
        };
      }

      if (node.kind === "infrastructure") {
        const data: InfrastructureNodeData = {
          ...node,
          type: "infrastructure",
          connectedNodes: node.connectedNodeIds
            .map((id) => nodeMap.get(id))
            .filter((value): value is AgentNodeDefinition | InfrastructureNodeDefinition =>
              value?.kind === "agent" || value?.kind === "infrastructure",
            )
            .map((n) => ({ id: n.id, label: n.label })),
        };

        return {
          id: node.id,
          type: "infrastructureNode",
          position: node.position,
          data,
          draggable: true,
        };
      }

      const owner = nodeMap.get(node.parentAgentId);
      const data: ServiceNodeData = {
        ...node,
        type: "service",
        owner:
          owner && owner.kind === "agent"
            ? { id: owner.id, label: owner.label }
            : { id: node.parentAgentId, label: node.parentAgentId },
      };

      return {
        id: node.id,
        type: "serviceNode",
        position: node.position,
        data,
        draggable: true,
      };
    });

    const edges: ArchitectureFlowEdge[] = graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      type: "animatedDataEdge",
      data: {
        intensity: edge.intensity,
        color: edge.color,
      },
    }));

    return { nodes, edges };
  }, [lastEditedGame]);
}
