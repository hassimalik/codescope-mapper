import { strict as assert } from "node:assert";
import path from "node:path";
import { test } from "node:test";

import { buildFeatureMap } from "../src/feature-mapper.js";
import { buildCodeGraphFromFiles } from "../src/graph/graph-builder.js";
import { buildFileAudit } from "../src/explorer/file-audit.js";
import { scanRepository } from "../src/scanner.js";

const repositoryPath = path.resolve("test-fixtures/relationship-repository");

test("builds a repository-relative audit with linked graph nodes and feature data", async () => {
  const files = await scanRepository(repositoryPath);
  const graph = await buildCodeGraphFromFiles(repositoryPath, files);
  const featureMap = buildFeatureMap(graph);
  const audit = await buildFileAudit(
    files,
    graph,
    featureMap,
    "src/helpers.ts",
  );

  assert.ok(audit);
  assert.equal(audit.file.relativePath, "src/helpers.ts");
  assert.ok(audit.symbols.some((symbol) => symbol.name === "localTarget"));
  assert.ok(
    audit.relationships.some(
      (relationship) =>
        relationship.type === "CALLS" &&
        relationship.from === "src/consumer.ts:run:16",
    ),
  );
  assert.ok(audit.graphNodes.some((node) => node.id === "src/consumer.ts"));
  assert.ok(audit.feature?.files.includes("src/helpers.ts"));

  const serialized = JSON.stringify(audit);
  assert.ok(!serialized.includes(repositoryPath));
});

test("returns undefined when the selected file is not in the repository inventory", async () => {
  const files = await scanRepository(repositoryPath);
  const graph = await buildCodeGraphFromFiles(repositoryPath, files);

  assert.equal(
    await buildFileAudit(
      files,
      graph,
      buildFeatureMap(graph),
      "src/missing.ts",
    ),
    undefined,
  );
});
