import { CodeGraph } from "./graph/code-graph.js";

export type FeatureRelationshipType =
  "IMPORTS" | "CALLS" | "REFERENCES" | "EXPORTS";

export interface FeatureRelationship {
  from: string;
  to: string;
  type: FeatureRelationshipType;
}

export interface Feature {
  id: string;
  name: string;
  files: string[];
  symbols: string[];
  relationships: FeatureRelationship[];
}

export interface FeatureMap {
  features: Feature[];
  summary: {
    totalFeatures: number;
    totalFiles: number;
    totalSymbols: number;
    totalFeatureRelationships: number;
  };
}

const ROOT_SEGMENTS = new Set([
  "src",
  "app",
  "lib",
  "pages",
  "components",
  "packages",
  "features",
]);

export function buildFeatureMap(graph: CodeGraph): FeatureMap {
  const fileNodes = graph.nodes.filter((node) => node.type === "file");
  const symbolNodes = graph.nodes.filter((node) => node.type !== "file");

  const featureMap = new Map<string, Feature>();

  for (const fileNode of fileNodes) {
    const featureName = deriveFeatureName(fileNode.name);
    const featureId = featureName;

    const feature = featureMap.get(featureId) ?? {
      id: featureId,
      name: featureName,
      files: [],
      symbols: [],
      relationships: [],
    };

    feature.files.push(fileNode.name);
    feature.files = Array.from(new Set(feature.files)).sort();

    featureMap.set(featureId, feature);
  }

  for (const symbolNode of symbolNodes) {
    const featureName = deriveFeatureName(symbolNode.location.file);
    const featureId = featureName;

    const feature = featureMap.get(featureId) ?? {
      id: featureId,
      name: featureName,
      files: [],
      symbols: [],
      relationships: [],
    };

    feature.symbols.push(symbolNode.id);
    feature.symbols = Array.from(new Set(feature.symbols)).sort();

    featureMap.set(featureId, feature);
  }

  for (const relationship of graph.relationships) {
    const fromNode = graph.nodes.find((node) => node.id === relationship.from);
    const toNode = graph.nodes.find((node) => node.id === relationship.to);

    if (!fromNode || !toNode || relationship.type === "CONTAINS") {
      continue;
    }

    const fromFeature = deriveFeatureName(
      fromNode.type === "file" ? fromNode.name : fromNode.location.file,
    );
    const toFeature = deriveFeatureName(
      toNode.type === "file" ? toNode.name : toNode.location.file,
    );

    if (fromFeature === toFeature) {
      continue;
    }

    const relationshipType = relationship.type as FeatureRelationshipType;

    const sourceFeature = featureMap.get(fromFeature);
    const targetFeature = featureMap.get(toFeature);

    if (!sourceFeature || !targetFeature) {
      continue;
    }

    const featureRelationship = {
      from: sourceFeature.id,
      to: targetFeature.id,
      type: relationshipType,
    };

    if (
      !sourceFeature.relationships.some(
        (item) =>
          item.from === featureRelationship.from &&
          item.type === featureRelationship.type &&
          item.to === featureRelationship.to,
      )
    ) {
      sourceFeature.relationships.push(featureRelationship);
    }
  }

  const features = Array.from(featureMap.values())
    .map((feature) => {
      const uniqueRelationships = Array.from(
        new Map(
          feature.relationships.map((relationship) => [
            [relationship.from, relationship.type, relationship.to].join("|"),
            relationship,
          ]),
        ).values(),
      );

      return {
        ...feature,
        files: Array.from(new Set(feature.files)).sort(),
        symbols: Array.from(new Set(feature.symbols)).sort(),
        relationships: uniqueRelationships.sort((left, right) =>
          [left.from, left.type, left.to]
            .join("|")
            .localeCompare([right.from, right.type, right.to].join("|")),
        ),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    features,
    summary: {
      totalFeatures: features.length,
      totalFiles: features.reduce(
        (accumulator, feature) => accumulator + feature.files.length,
        0,
      ),
      totalSymbols: features.reduce(
        (accumulator, feature) => accumulator + feature.symbols.length,
        0,
      ),
      totalFeatureRelationships: features.reduce(
        (accumulator, feature) => accumulator + feature.relationships.length,
        0,
      ),
    },
  };
}

function deriveFeatureName(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, "/").replace(/^\.\//, "");

  if (!normalizedPath || normalizedPath === ".") {
    return "root";
  }

  const segments = normalizedPath
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/\.[^/.]+$/, ""));

  if (segments.length === 0) {
    return "root";
  }

  const lastSegment = segments[segments.length - 1];

  if (lastSegment === "index" && segments.length > 1) {
    return segments[segments.length - 2] ?? "root";
  }

  const parent =
    segments.length > 1 ? segments[segments.length - 2] : undefined;

  if (parent && !ROOT_SEGMENTS.has(parent)) {
    return parent;
  }

  return lastSegment || "root";
}
