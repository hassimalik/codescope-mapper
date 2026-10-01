import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { buildCodeGraph } from "../src/graph/graph-builder.js";

test("builds a CodeGraph with file nodes, symbol nodes, and relationships", async () => {
  const repositoryPath = mkdtempSync(
    path.join(tmpdir(), "codebase-feature-mapper-"),
  );

  try {
    const appDirectory = path.join(repositoryPath, "app");

    mkdirSync(appDirectory, {
      recursive: true,
    });

    const greetingPath = path.join(appDirectory, "Greeting.ts");
    const pagePath = path.join(appDirectory, "page.ts");

    const greetingSource = `
      export function getGreeting() {
        return "Hello";
      }
    `;

    const pageSource = `
      import { getGreeting } from "./Greeting";

      export function Home() {
        getGreeting();
      }
    `;

    writeFileSync(greetingPath, greetingSource);
    writeFileSync(pagePath, pageSource);

    const graph = await buildCodeGraph(repositoryPath);

    assert.equal(graph.nodes.length, 4);

    assert.ok(
      graph.nodes.some(
        (node) => node.id === "app/Greeting.ts" && node.type === "file",
      ),
    );

    assert.ok(
      graph.nodes.some(
        (node) => node.id === "app/page.ts" && node.type === "file",
      ),
    );

    assert.ok(
      graph.nodes.some(
        (node) =>
          node.id === "app/Greeting.ts:getGreeting:2" &&
          node.type === "function",
      ),
    );

    assert.ok(
      graph.nodes.some(
        (node) => node.id === "app/page.ts:Home:4" && node.type === "function",
      ),
    );

    assert.ok(
      graph.relationships.some(
        (relationship) =>
          relationship.type === "CONTAINS" &&
          relationship.from === "app/Greeting.ts" &&
          relationship.to === "app/Greeting.ts:getGreeting:2",
      ),
    );

    assert.ok(
      graph.relationships.some(
        (relationship) =>
          relationship.type === "CONTAINS" &&
          relationship.from === "app/page.ts" &&
          relationship.to === "app/page.ts:Home:4",
      ),
    );

    assert.ok(
      graph.relationships.some(
        (relationship) =>
          relationship.type === "IMPORTS" &&
          relationship.from === "app/page.ts" &&
          relationship.to === "app/Greeting.ts",
      ),
    );

    assert.ok(
      graph.relationships.some(
        (relationship) =>
          relationship.type === "REFERENCES" &&
          relationship.from === "app/page.ts" &&
          relationship.to === "app/Greeting.ts:getGreeting:2",
      ),
    );

    assert.ok(
      graph.relationships.some(
        (relationship) =>
          relationship.type === "CALLS" &&
          relationship.from === "app/page.ts:Home:4" &&
          relationship.to === "app/Greeting.ts:getGreeting:2",
      ),
    );
  } finally {
    rmSync(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});
