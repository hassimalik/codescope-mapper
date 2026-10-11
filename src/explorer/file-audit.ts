import type { FeatureMap, Feature } from "../feature-mapper.js";
import type { CodeGraph } from "../graph/code-graph.js";
import { readRepositoryFile } from "./file-details.js";
import type { RepositoryFileDetails } from "./file-details.js";
import type { CodeRelationship } from "../types/relationships.js";
import type { CodeSymbol } from "../symbol.js";
import type { SourceFile } from "../types/source-file.js";

export interface FileAudit {
  file: RepositoryFileDetails;
  symbols: CodeSymbol[];
  relationships: CodeRelationship[];
  graphNodes: CodeSymbol[];
  feature?: Feature;
}

export async function buildFileAudit(
  files: SourceFile[],
  graph: CodeGraph,
  featureMap: FeatureMap,
  relativePath: string,
): Promise<FileAudit | undefined> {
  const file = await readRepositoryFile(files, relativePath);
  if (!file) {
    return undefined;
  }

  const fileNode = graph.nodes.find(
    (node) => node.type === "file" && node.id === file.relativePath,
  );
  const symbols = graph.nodes.filter(
    (node) => node.type !== "file" && node.location.file === file.relativePath,
  );
  const fileNodeIds = new Set([
    ...(fileNode ? [fileNode.id] : []),
    ...symbols.map((symbol) => symbol.id),
  ]);
  const relationships = graph.relationships.filter(
    (relationship) =>
      fileNodeIds.has(relationship.from) || fileNodeIds.has(relationship.to),
  );
  const endpointIds = new Set(
    relationships.flatMap((relationship) => [
      relationship.from,
      relationship.to,
    ]),
  );
  const graphNodes = graph.nodes.filter((node) => endpointIds.has(node.id));
  const feature = featureMap.features.find((candidate) =>
    candidate.files.includes(file.relativePath),
  );

  return {
    file,
    symbols,
    relationships,
    graphNodes,
    ...(feature ? { feature } : {}),
  };
}
