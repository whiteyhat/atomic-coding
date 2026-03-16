"use client";

import {
  useCallback,
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import type { LastEditedGame } from "@/lib/analytics";
import { AnimatedDataEdge } from "./edges/AnimatedDataEdge";
import {
  type ArchitectureFlowEdge,
  type ArchitectureFlowNode,
  type ArchitectureNodeData,
  useArchitectureState,
} from "./hooks/useArchitectureState";
import { AgentNode } from "./nodes/AgentNode";
import { InfrastructureNode } from "./nodes/InfrastructureNode";
import { PlatformNode } from "./nodes/PlatformNode";
import { ServiceNode } from "./nodes/ServiceNode";
import { NodeDetailPanel } from "./panels/NodeDetailPanel";

const nodeTypes: NodeTypes = {
  platformNode: PlatformNode,
  agentNode: AgentNode,
  serviceNode: ServiceNode,
  infrastructureNode: InfrastructureNode,
};

const edgeTypes: EdgeTypes = {
  animatedDataEdge: AnimatedDataEdge,
};

interface ArchitectureCanvasProps {
  lastEditedGame: LastEditedGame | null;
}

export function ArchitectureCanvas({
  lastEditedGame,
}: ArchitectureCanvasProps) {
  const { nodes: initialNodes, edges: initialEdges } =
    useArchitectureState(lastEditedGame);
  const [nodes, setNodes, onNodesChange] =
    useNodesState<ArchitectureFlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] =
    useEdgesState<ArchitectureFlowEdge>(initialEdges);
  const [selectedNode, setSelectedNode] =
    useState<ArchitectureFlowNode | null>(null);
  const { fitView, getNode } =
    useReactFlow<ArchitectureFlowNode, ArchitectureFlowEdge>();

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const handleNodeClick = useCallback(
    (_event: ReactMouseEvent, node: ArchitectureFlowNode) => {
      setSelectedNode(node);
    },
    [],
  );

  const handleNavigateToNode = useCallback(
    (nodeId: string) => {
      const targetNode = getNode(nodeId);
      if (!targetNode) return;

      setSelectedNode(null);
      setTimeout(() => {
        fitView({
          nodes: [{ id: nodeId }],
          duration: 650,
          padding: 0.6,
          maxZoom: 1.35,
        });
        setTimeout(() => {
          const refreshedNode = getNode(nodeId);
          if (refreshedNode) setSelectedNode(refreshedNode);
        }, 700);
      }, 180);
    },
    [fitView, getNode],
  );

  return (
    <div className="relative h-full w-full">
      <svg className="absolute h-0 w-0">
        <defs>
          <filter id="architecture-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={() => setSelectedNode(null)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.28, maxZoom: 1.18 }}
        minZoom={0.24}
        maxZoom={1.95}
        proOptions={{ hideAttribution: true }}
        className="bg-[radial-gradient(circle_at_top,rgba(80,20,34,0.35)_0%,rgba(18,6,10,0.94)_62%,rgba(8,2,4,0.98)_100%)]"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={26}
          size={1.2}
          color="rgba(255,255,255,0.05)"
        />

        <Controls
          position="top-right"
          showInteractive={false}
        />

        <MiniMap
          position="bottom-left"
          zoomable
          pannable
          maskColor="rgba(4, 0, 1, 0.74)"
          style={{
            background: "rgba(25, 9, 14, 0.85)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 18,
          }}
          nodeColor={(node) => {
            const data = node.data as ArchitectureNodeData | undefined;
            if (!data) return "rgba(255,255,255,0.2)";
            if (data.type === "platform") return "#fb7185";
            if (data.type === "agent") return data.accentColor;
            if (data.type === "infrastructure") return "#4285F4";
            return "rgba(255,255,255,0.28)";
          }}
        />
      </ReactFlow>

      <NodeDetailPanel
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onNavigateToNode={handleNavigateToNode}
      />

      <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-black/25 px-4 py-2 backdrop-blur-xl">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
          Static system map
        </span>
        <span className="text-xs text-white/40">
          Atomic core, Gemini AI backbone, 4 agents, curated service fan-out
        </span>
      </div>
    </div>
  );
}
