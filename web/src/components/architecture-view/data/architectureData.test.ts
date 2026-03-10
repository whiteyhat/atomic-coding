import { describe, expect, it } from "vitest";
import {
  ARCHITECTURE_AGENT_COUNT,
  ARCHITECTURE_SERVICE_COUNT,
  buildArchitectureGraph,
} from "./architectureData";

describe("buildArchitectureGraph", () => {
  it("creates the center platform node and four agent nodes", () => {
    const graph = buildArchitectureGraph();
    const platformNodes = graph.nodes.filter((node) => node.kind === "platform");
    const agentNodes = graph.nodes.filter((node) => node.kind === "agent");

    expect(platformNodes).toHaveLength(1);
    expect(agentNodes).toHaveLength(ARCHITECTURE_AGENT_COUNT);
  });

  it("fans out the expected number of service nodes", () => {
    const graph = buildArchitectureGraph();
    const serviceNodes = graph.nodes.filter((node) => node.kind === "service");

    expect(serviceNodes).toHaveLength(ARCHITECTURE_SERVICE_COUNT);
  });

  it("creates one platform edge per agent and one service edge per service", () => {
    const graph = buildArchitectureGraph();
    const platformEdges = graph.edges.filter((edge) => edge.source === "platform");
    const serviceEdges = graph.edges.filter((edge) => edge.source !== "platform");

    expect(platformEdges).toHaveLength(ARCHITECTURE_AGENT_COUNT);
    expect(serviceEdges).toHaveLength(ARCHITECTURE_SERVICE_COUNT);
    expect(graph.edges).toHaveLength(
      ARCHITECTURE_AGENT_COUNT + ARCHITECTURE_SERVICE_COUNT,
    );
  });
});
