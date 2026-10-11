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
