import { strict as assert } from "node:assert";
import path from "node:path";
import { test } from "node:test";

import { buildCodeGraph } from "../src/graph/graph-builder.js";

const repositoryPath = path.resolve("test-fixtures/relationship-repository");

test("builds repository-relative graph relationships from a fixture repository", async () => {
  const graph = await buildCodeGraph(repositoryPath);
  const findSymbol = (file: string, name: string) => {
    const symbol = graph.nodes.find(
      (node) =>
        node.type !== "file" &&
        node.location.file === file &&
        node.name === name,
    );

    assert.ok(symbol, `Expected ${name} symbol in ${file}`);
    return symbol;
  };

  const consumerPath = "src/consumer.ts";
  const helpersPath = "src/helpers.ts";
  const servicesPath = "src/services.ts";
  const localTarget = findSymbol(helpersPath, "localTarget");
  const sameFileTarget = findSymbol(consumerPath, "sameFileTarget");
  const arrowTarget = findSymbol(consumerPath, "arrowTarget");
  const arrowCaller = findSymbol(consumerPath, "arrowCaller");
  const run = findSymbol(consumerPath, "run");
  const importedReference = findSymbol(consumerPath, "importedReference");
  const authService = findSymbol(servicesPath, "AuthService");
  const login = findSymbol(servicesPath, "login");
  const constructor = findSymbol(servicesPath, "constructor");

  const relationshipKeys = graph.relationships.map((relationship) =>
    [relationship.from, relationship.type, relationship.to].join("|"),
  );

  assert.equal(new Set(relationshipKeys).size, relationshipKeys.length);
  assert.ok(
    graph.relationships.some(
      (relationship) =>
        relationship.type === "CONTAINS" &&
        relationship.from === consumerPath &&
        relationship.to === run.id,
    ),
  );
  assert.ok(
    graph.relationships.some(
      (relationship) =>
        relationship.type === "CONTAINS" &&
        relationship.from === authService.id &&
        relationship.to === login.id,
    ),
  );
  assert.ok(
    graph.relationships.some(
      (relationship) =>
        relationship.type === "CONTAINS" &&
        relationship.from === authService.id &&
        relationship.to === constructor.id,
    ),
  );
  assert.ok(
    graph.relationships.some(
      (relationship) =>
        relationship.type === "CONTAINS" &&
        relationship.from === consumerPath &&
        relationship.to === importedReference.id,
    ),
  );
  assert.ok(
    graph.relationships.some(
      (relationship) =>
        relationship.type === "CONTAINS" &&
        relationship.from === helpersPath &&
        relationship.to === localTarget.id,
    ),
  );

  assert.ok(
    graph.relationships.some(
      (relationship) =>
        relationship.type === "CALLS" &&
        relationship.from === run.id &&
        relationship.to === sameFileTarget.id,
    ),
  );
  assert.ok(
    graph.relationships.some(
      (relationship) =>
        relationship.type === "CALLS" &&
        relationship.from === run.id &&
        relationship.to === localTarget.id,
    ),
  );
  assert.ok(
    graph.relationships.some(
      (relationship) =>
        relationship.type === "CALLS" &&
        relationship.from === arrowCaller.id &&
        relationship.to === arrowTarget.id,
    ),
  );
  assert.ok(
    graph.relationships.some(
      (relationship) =>
        relationship.type === "REFERENCES" &&
        relationship.from === consumerPath &&
        relationship.to === localTarget.id,
    ),
  );
  assert.ok(
    graph.relationships.some(
      (relationship) =>
        relationship.type === "IMPORTS" &&
        relationship.from === consumerPath &&
        relationship.to === helpersPath,
    ),
  );

  const sameFileCalls = graph.relationships.filter(
    (relationship) =>
      relationship.type === "CALLS" &&
      relationship.from === run.id &&
      relationship.to === sameFileTarget.id,
  );
  assert.equal(sameFileCalls.length, 1);

  assert.ok(
    graph.relationships.some(
      (relationship) =>
        relationship.type === "IMPORTS" &&
        relationship.from === consumerPath &&
        relationship.to === "node:fs",
    ),
  );
  assert.ok(!graph.nodes.some((node) => node.id === "node:fs"));

  for (const node of graph.nodes) {
    assert.ok(
      !node.id.startsWith("/"),
      `Expected relative node ID: ${node.id}`,
    );
    assert.ok(
      !node.location.file.startsWith("/"),
      `Expected relative source path: ${node.location.file}`,
    );
  }
});
