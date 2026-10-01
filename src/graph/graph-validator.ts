import { CodeGraph } from "./code-graph.js";

const EXTERNAL_RELATIONSHIP_TYPES = new Set(["IMPORTS"]);

export function validateCodeGraph(graph: CodeGraph): string[] {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));

  const errors: string[] = [];

  for (const relationship of graph.relationships) {
    if (!nodeIds.has(relationship.from)) {
      errors.push(
        `Relationship ${relationship.type} has missing source node: ${relationship.from}`,
      );
    }

    if (
      !nodeIds.has(relationship.to) &&
      !EXTERNAL_RELATIONSHIP_TYPES.has(relationship.type)
    ) {
      errors.push(
        `Relationship ${relationship.type} has missing target node: ${relationship.to}`,
      );
    }
  }

  return errors;
}
