import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

import { extractRelationships } from "../src/relationship-extractor.js";

test("extracts a CALLS relationship for same-file function calls", () => {
  const source = `
    function greet() {
      return "Hello";
    }

    function main() {
      greet();
    }
  `;

  const sourceFile = ts.createSourceFile(
    "test.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const symbols = [
    {
      id: "test.ts:greet:2",
      name: "greet",
      type: "function" as const,
      location: {
        file: "test.ts",
        startLine: 2,
        startColumn: 5,
        endLine: 4,
        endColumn: 6,
      },
    },
    {
      id: "test.ts:main:6",
      name: "main",
      type: "function" as const,
      location: {
        file: "test.ts",
        startLine: 6,
        startColumn: 5,
        endLine: 8,
        endColumn: 6,
      },
    },
  ];

  const relationships = extractRelationships(
    sourceFile,
    "/repo/test.ts",
    "/repo",
    symbols,
  );

  const calls = relationships.filter(
    (relationship) => relationship.type === "CALLS",
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].from, "test.ts:main:6");
  assert.equal(calls[0].to, "test.ts:greet:2");
});

test("extracts a CALLS relationship across files", () => {
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

    const greetingFile = ts.createSourceFile(
      greetingPath,
      greetingSource,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const pageFile = ts.createSourceFile(
      pagePath,
      pageSource,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const symbols = [
      {
        id: "app/Greeting.ts:getGreeting:2",
        name: "getGreeting",
        type: "function" as const,
        location: {
          file: "app/Greeting.ts",
          startLine: 2,
          startColumn: 7,
          endLine: 4,
          endColumn: 8,
        },
      },
      {
        id: "app/page.ts:Home:4",
        name: "Home",
        type: "function" as const,
        location: {
          file: "app/page.ts",
          startLine: 4,
          startColumn: 7,
          endLine: 6,
          endColumn: 8,
        },
      },
    ];

    const relationships = extractRelationships(
      pageFile,
      pagePath,
      repositoryPath,
      symbols,
    );

    const calls = relationships.filter(
      (relationship) => relationship.type === "CALLS",
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].from, "app/page.ts:Home:4");
    assert.equal(calls[0].to, "app/Greeting.ts:getGreeting:2");
  } finally {
    rmSync(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});

test("resolves aliased imports when extracting CALLS relationships", () => {
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
      import { getGreeting as greeting } from "./Greeting";

      export function Home() {
        greeting();
      }
    `;

    writeFileSync(greetingPath, greetingSource);
    writeFileSync(pagePath, pageSource);

    const pageFile = ts.createSourceFile(
      pagePath,
      pageSource,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const symbols = [
      {
        id: "app/Greeting.ts:getGreeting:2",
        name: "getGreeting",
        type: "function" as const,
        location: {
          file: "app/Greeting.ts",
          startLine: 2,
          startColumn: 7,
          endLine: 4,
          endColumn: 8,
        },
      },
      {
        id: "app/page.ts:Home:4",
        name: "Home",
        type: "function" as const,
        location: {
          file: "app/page.ts",
          startLine: 4,
          startColumn: 7,
          endLine: 6,
          endColumn: 8,
        },
      },
    ];

    const relationships = extractRelationships(
      pageFile,
      pagePath,
      repositoryPath,
      symbols,
    );

    const calls = relationships.filter(
      (relationship) => relationship.type === "CALLS",
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].from, "app/page.ts:Home:4");
    assert.equal(calls[0].to, "app/Greeting.ts:getGreeting:2");
  } finally {
    rmSync(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});

test("extracts a CALLS relationship for property access calls", () => {
  const source = `
function getGreeting() {
return "Hello";
}

function main() {
  const service = {
    getGreeting,
  };

  service.getGreeting();
}

`;

  const sourceFile = ts.createSourceFile(
    "test.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const symbols = [
    {
      id: "test.ts:getGreeting:2",
      name: "getGreeting",
      type: "function" as const,
      location: {
        file: "test.ts",
        startLine: 2,
        startColumn: 5,
        endLine: 4,
        endColumn: 6,
      },
    },
    {
      id: "test.ts:main:6",
      name: "main",
      type: "function" as const,
      location: {
        file: "test.ts",
        startLine: 6,
        startColumn: 5,
        endLine: 12,
        endColumn: 6,
      },
    },
  ];

  const relationships = extractRelationships(
    sourceFile,
    "/repo/test.ts",
    "/repo",
    symbols,
  );

  const calls = relationships.filter(
    (relationship) => relationship.type === "CALLS",
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].from, "test.ts:main:6");
  assert.equal(calls[0].to, "test.ts:getGreeting:2");
});

test("resolves default imports when extracting CALLS relationships", () => {
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
  export default function getGreeting() {
    return "Hello";
  }
`;

    const pageSource = `
  import getGreeting from "./Greeting";

  export function Home() {
    getGreeting();
  }
`;

    writeFileSync(greetingPath, greetingSource);
    writeFileSync(pagePath, pageSource);

    const pageFile = ts.createSourceFile(
      pagePath,
      pageSource,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const symbols = [
      {
        id: "app/Greeting.ts:getGreeting:2",
        name: "getGreeting",
        type: "function" as const,
        location: {
          file: "app/Greeting.ts",
          startLine: 2,
          startColumn: 7,
          endLine: 4,
          endColumn: 8,
        },
      },
      {
        id: "app/page.ts:Home:4",
        name: "Home",
        type: "function" as const,
        location: {
          file: "app/page.ts",
          startLine: 4,
          startColumn: 7,
          endLine: 6,
          endColumn: 8,
        },
      },
    ];

    const relationships = extractRelationships(
      pageFile,
      pagePath,
      repositoryPath,
      symbols,
    );

    const calls = relationships.filter(
      (relationship) => relationship.type === "CALLS",
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].from, "app/page.ts:Home:4");
    assert.equal(calls[0].to, "app/Greeting.ts:getGreeting:2");
  } finally {
    rmSync(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});

test("extracts a REFERENCES relationship for imported symbols", () => {
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
  export function Greeting() {
    return "Hello";
  }
`;

    const pageSource = `
  import { Greeting } from "./Greeting";

  export function Home() {
    return Greeting;
  }
`;

    writeFileSync(greetingPath, greetingSource);
    writeFileSync(pagePath, pageSource);

    const pageFile = ts.createSourceFile(
      pagePath,
      pageSource,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const symbols = [
      {
        id: "app/Greeting.ts:Greeting:2",
        name: "Greeting",
        type: "function" as const,
        location: {
          file: "app/Greeting.ts",
          startLine: 2,
          startColumn: 7,
          endLine: 4,
          endColumn: 8,
        },
      },
      {
        id: "app/page.ts:Home:4",
        name: "Home",
        type: "function" as const,
        location: {
          file: "app/page.ts",
          startLine: 4,
          startColumn: 7,
          endLine: 6,
          endColumn: 8,
        },
      },
    ];

    const relationships = extractRelationships(
      pageFile,
      pagePath,
      repositoryPath,
      symbols,
    );

    const references = relationships.filter(
      (relationship) => relationship.type === "REFERENCES",
    );

    assert.equal(references.length, 1);
    assert.equal(references[0].from, "app/page.ts");
    assert.equal(references[0].to, "app/Greeting.ts:Greeting:2");
  } finally {
    rmSync(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});
