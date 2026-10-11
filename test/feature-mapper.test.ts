import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildFeatureMap } from "../src/feature-mapper.js";
import type { CodeGraph } from "../src/graph/code-graph.js";

const graph: CodeGraph = {
  nodes: [
    {
      id: "src/app/page.ts",
      name: "src/app/page.ts",
      type: "file",
      location: {
        file: "src/app/page.ts",
        startLine: 1,
        startColumn: 1,
        endLine: 11,
        endColumn: 1,
      },
    },
    {
      id: "src/app/page.ts:Home:1",
      name: "Home",
      type: "function",
      location: {
        file: "src/app/page.ts",
        startLine: 1,
        startColumn: 1,
        endLine: 5,
        endColumn: 2,
      },
    },
    {
      id: "src/features/auth/index.ts",
      name: "src/features/auth/index.ts",
      type: "file",
      location: {
        file: "src/features/auth/index.ts",
        startLine: 1,
        startColumn: 1,
        endLine: 10,
        endColumn: 1,
      },
    },
    {
      id: "src/features/auth/index.ts:getUser:1",
      name: "getUser",
      type: "function",
      location: {
        file: "src/features/auth/index.ts",
        startLine: 1,
        startColumn: 1,
        endLine: 5,
        endColumn: 2,
      },
    },
  ],
  relationships: [
    {
      from: "src/app/page.ts",
      to: "src/app/page.ts:Home:1",
      type: "CONTAINS",
    },
    {
      from: "src/app/page.ts",
      to: "src/features/auth/index.ts",
      type: "IMPORTS",
    },
    {
      from: "src/features/auth/index.ts",
      to: "src/app/page.ts",
      type: "EXPORTS",
    },
    {
      from: "src/app/page.ts:Home:1",
      to: "src/features/auth/index.ts:getUser:1",
      type: "CALLS",
    },
  ],
};

test("builds a feature map grouped by file directory and relationships", () => {
  const featureMap = buildFeatureMap(graph);

  assert.equal(featureMap.summary.totalFeatures, 2);
  assert.equal(
    featureMap.features.some((feature) => feature.name === "page"),
    true,
  );
  assert.equal(
    featureMap.features.some((feature) => feature.name === "auth"),
    true,
  );

  const pageFeature = featureMap.features.find(
    (feature) => feature.name === "page",
  );
  const authFeature = featureMap.features.find(
    (feature) => feature.name === "auth",
  );

  assert.ok(pageFeature);
  assert.ok(authFeature);

  assert.deepEqual(pageFeature.files, ["src/app/page.ts"]);
  assert.deepEqual(authFeature.files, ["src/features/auth/index.ts"]);

  assert.ok(
    pageFeature.relationships.some(
      (relationship) =>
        relationship.type === "IMPORTS" && relationship.to === "auth",
    ),
  );
  assert.ok(
    authFeature.relationships.some(
      (relationship) =>
        relationship.type === "EXPORTS" && relationship.to === "page",
    ),
  );
});

test("does not report external modules or unresolved targets as code groups", () => {
  const graphWithExternalModule: CodeGraph = {
    nodes: graph.nodes,
    relationships: [
      ...graph.relationships,
      {
        from: "src/app/page.ts",
        to: "react",
        type: "IMPORTS",
      },
      {
        from: "src/app/page.ts",
        to: "src/missing.ts",
        type: "IMPORTS",
      },
    ],
  };

  const featureMap = buildFeatureMap(graphWithExternalModule);

  assert.deepEqual(
    featureMap.features.map((feature) => feature.name),
    ["auth", "page"],
  );
  assert.equal(featureMap.summary.totalFeatures, featureMap.features.length);
  assert.ok(
    featureMap.features.every(
      (feature) => feature.files.length > 0 || feature.symbols.length > 0,
    ),
  );
});

test("returns zero counts and no groups for an empty graph", () => {
  const featureMap = buildFeatureMap({ nodes: [], relationships: [] });

  assert.deepEqual(featureMap, {
    features: [],
    summary: {
      totalFeatures: 0,
      totalFiles: 0,
      totalSymbols: 0,
      totalFeatureRelationships: 0,
    },
  });
});

test("keeps symbols in root-level index files represented in group counts", () => {
  const rootIndexGraph: CodeGraph = {
    nodes: [
      {
        id: "src/index.ts",
        name: "src/index.ts",
        type: "file",
        location: {
          file: "src/index.ts",
          startLine: 1,
          startColumn: 1,
          endLine: 4,
          endColumn: 1,
        },
      },
      {
        id: "src/index.ts:main:1",
        name: "main",
        type: "function",
        location: {
          file: "src/index.ts",
          startLine: 1,
          startColumn: 1,
          endLine: 3,
          endColumn: 2,
        },
      },
    ],
    relationships: [
      {
        from: "src/index.ts",
        to: "src/index.ts:main:1",
        type: "CONTAINS",
      },
    ],
  };

  const featureMap = buildFeatureMap(rootIndexGraph);

  assert.equal(featureMap.summary.totalFeatures, 1);
  assert.equal(featureMap.summary.totalFiles, 1);
  assert.equal(featureMap.summary.totalSymbols, 1);
  assert.equal(featureMap.features[0]?.name, "src");
});
