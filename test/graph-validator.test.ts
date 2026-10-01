import { strict as assert } from "node:assert";
import { test } from "node:test";

import { validateCodeGraph } from "../src/graph/graph-validator.js";
import { CodeGraph } from "../src/graph/code-graph.js";

test("accepts a valid CodeGraph", () => {
  const graph: CodeGraph = {
    nodes: [
      {
        id: "app/page.ts",
        name: "app/page.ts",
        type: "file",
        location: {
          file: "app/page.ts",
          startLine: 1,
          startColumn: 1,
          endLine: 10,
          endColumn: 1,
        },
      },
      {
        id: "app/page.ts:Home:1",
        name: "Home",
        type: "function",
        location: {
          file: "app/page.ts",
          startLine: 1,
          startColumn: 1,
          endLine: 5,
          endColumn: 2,
        },
      },
    ],
    relationships: [
      {
        from: "app/page.ts",
        to: "app/page.ts:Home:1",
        type: "CONTAINS",
      },
      {
        from: "app/page.ts",
        to: "react",
        type: "IMPORTS",
      },
    ],
  };

  const errors = validateCodeGraph(graph);

  assert.deepEqual(errors, []);
});

test("detects a missing relationship target node", () => {
  const graph: CodeGraph = {
    nodes: [
      {
        id: "app/page.ts",
        name: "app/page.ts",
        type: "file",
        location: {
          file: "app/page.ts",
          startLine: 1,
          startColumn: 1,
          endLine: 10,
          endColumn: 1,
        },
      },
    ],
    relationships: [
      {
        from: "app/page.ts",
        to: "app/page.ts:Missing:1",
        type: "CALLS",
      },
    ],
  };

  const errors = validateCodeGraph(graph);

  assert.equal(errors.length, 1);
  assert.equal(
    errors[0],
    "Relationship CALLS has missing target node: app/page.ts:Missing:1",
  );
});

test("detects a missing relationship source node", () => {
  const graph: CodeGraph = {
    nodes: [
      {
        id: "app/page.ts:Home:1",
        name: "Home",
        type: "function",
        location: {
          file: "app/page.ts",
          startLine: 1,
          startColumn: 1,
          endLine: 5,
          endColumn: 2,
        },
      },
    ],
    relationships: [
      {
        from: "app/page.ts",
        to: "app/page.ts:Home:1",
        type: "CONTAINS",
      },
    ],
  };

  const errors = validateCodeGraph(graph);

  assert.equal(errors.length, 1);
  assert.equal(
    errors[0],
    "Relationship CONTAINS has missing source node: app/page.ts",
  );
});

test("allows IMPORTS relationships to external modules", () => {
  const graph: CodeGraph = {
    nodes: [
      {
        id: "app/page.ts",
        name: "app/page.ts",
        type: "file",
        location: {
          file: "app/page.ts",
          startLine: 1,
          startColumn: 1,
          endLine: 5,
          endColumn: 1,
        },
      },
    ],
    relationships: [
      {
        from: "app/page.ts",
        to: "next",
        type: "IMPORTS",
      },
    ],
  };

  const errors = validateCodeGraph(graph);

  assert.deepEqual(errors, []);
});
