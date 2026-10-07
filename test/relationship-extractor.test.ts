import { strict as assert } from "node:assert";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

import { extractRelationships } from "../src/relationship-extractor.js";
import type { CodeSymbol } from "../src/symbol.js";

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
    "test.ts",
    ".",
    symbols,
  );

  assert.ok(
    relationships.some(
      (relationship) =>
        relationship.type === "CALLS" &&
        relationship.from === "test.ts:main:6" &&
        relationship.to === "test.ts:greet:2",
    ),
  );
});

test("extracts a CALLS relationship across files", () => {
  const repositoryPath = mkdtempSync(
    path.join(tmpdir(), "codebase-feature-mapper-"),
  );

  try {
    const greetingPath = path.join(repositoryPath, "greeting.ts");
    const mainPath = path.join(repositoryPath, "main.ts");

    writeFileSync(
      greetingPath,
      `
        export function getGreeting() {
          return "Hello";
        }
      `,
    );

    writeFileSync(
      mainPath,
      `
        import { getGreeting } from "./greeting";

        export function main() {
          getGreeting();
        }
      `,
    );

    const mainSourceFile = ts.createSourceFile(
      mainPath,
      readFileSync(mainPath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const knownSymbols = [
      {
        id: "greeting.ts:getGreeting:2",
        name: "getGreeting",
        type: "function" as const,
        location: {
          file: "greeting.ts",
          startLine: 2,
          startColumn: 25,
          endLine: 4,
          endColumn: 10,
        },
      },
      {
        id: "main.ts:main:4",
        name: "main",
        type: "function" as const,
        location: {
          file: "main.ts",
          startLine: 4,
          startColumn: 23,
          endLine: 6,
          endColumn: 10,
        },
      },
    ];

    const relationships = extractRelationships(
      mainSourceFile,
      mainPath,
      repositoryPath,
      knownSymbols,
    );

    assert.ok(
      relationships.some(
        (relationship) =>
          relationship.type === "CALLS" &&
          relationship.from === "main.ts:main:4" &&
          relationship.to === "greeting.ts:getGreeting:2",
      ),
    );
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
    const greetingPath = path.join(repositoryPath, "greeting.ts");
    const mainPath = path.join(repositoryPath, "main.ts");

    writeFileSync(
      greetingPath,
      `
        export function getGreeting() {
          return "Hello";
        }
      `,
    );

    writeFileSync(
      mainPath,
      `
        import { getGreeting as greet } from "./greeting";

        export function main() {
          greet();
        }
      `,
    );

    const mainSourceFile = ts.createSourceFile(
      mainPath,
      readFileSync(mainPath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const knownSymbols = [
      {
        id: "greeting.ts:getGreeting:2",
        name: "getGreeting",
        type: "function" as const,
        location: {
          file: "greeting.ts",
          startLine: 2,
          startColumn: 25,
          endLine: 4,
          endColumn: 10,
        },
      },
      {
        id: "main.ts:main:4",
        name: "main",
        type: "function" as const,
        location: {
          file: "main.ts",
          startLine: 4,
          startColumn: 23,
          endLine: 6,
          endColumn: 10,
        },
      },
    ];

    const relationships = extractRelationships(
      mainSourceFile,
      mainPath,
      repositoryPath,
      knownSymbols,
    );

    assert.ok(
      relationships.some(
        (relationship) =>
          relationship.type === "CALLS" &&
          relationship.from === "main.ts:main:4" &&
          relationship.to === "greeting.ts:getGreeting:2",
      ),
    );
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
        endLine: 8,
        endColumn: 6,
      },
    },
  ];

  const relationships = extractRelationships(
    sourceFile,
    "test.ts",
    ".",
    symbols,
  );

  assert.ok(
    relationships.some(
      (relationship) =>
        relationship.type === "CALLS" &&
        relationship.from === "test.ts:main:6" &&
        relationship.to === "test.ts:getGreeting:2",
    ),
  );
});

test("resolves default imports when extracting CALLS relationships", () => {
  const repositoryPath = mkdtempSync(
    path.join(tmpdir(), "codebase-feature-mapper-"),
  );

  try {
    const greetingPath = path.join(repositoryPath, "greeting.ts");
    const mainPath = path.join(repositoryPath, "main.ts");

    writeFileSync(
      greetingPath,
      `
        export default function greet() {
          return "Hello";
        }
      `,
    );

    writeFileSync(
      mainPath,
      `
        import greet from "./greeting";

        export function main() {
          greet();
        }
      `,
    );

    const mainSourceFile = ts.createSourceFile(
      mainPath,
      readFileSync(mainPath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const knownSymbols = [
      {
        id: "greeting.ts:greet:2",
        name: "greet",
        type: "function" as const,
        location: {
          file: "greeting.ts",
          startLine: 2,
          startColumn: 33,
          endLine: 4,
          endColumn: 10,
        },
      },
      {
        id: "main.ts:main:4",
        name: "main",
        type: "function" as const,
        location: {
          file: "main.ts",
          startLine: 4,
          startColumn: 23,
          endLine: 6,
          endColumn: 10,
        },
      },
    ];

    const relationships = extractRelationships(
      mainSourceFile,
      mainPath,
      repositoryPath,
      knownSymbols,
    );

    assert.ok(
      relationships.some(
        (relationship) =>
          relationship.type === "CALLS" &&
          relationship.from === "main.ts:main:4" &&
          relationship.to === "greeting.ts:greet:2",
      ),
    );
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
    const greetingPath = path.join(repositoryPath, "greeting.ts");
    const mainPath = path.join(repositoryPath, "main.ts");

    writeFileSync(
      greetingPath,
      `
        export function getGreeting() {
          return "Hello";
        }
      `,
    );

    writeFileSync(
      mainPath,
      `
        import { getGreeting } from "./greeting";

        export const message = getGreeting;
      `,
    );

    const mainSourceFile = ts.createSourceFile(
      mainPath,
      readFileSync(mainPath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const knownSymbols = [
      {
        id: "greeting.ts:getGreeting:2",
        name: "getGreeting",
        type: "function" as const,
        location: {
          file: "greeting.ts",
          startLine: 2,
          startColumn: 25,
          endLine: 4,
          endColumn: 10,
        },
      },
    ];

    const relationships = extractRelationships(
      mainSourceFile,
      mainPath,
      repositoryPath,
      knownSymbols,
    );

    assert.ok(
      relationships.some(
        (relationship) =>
          relationship.type === "REFERENCES" &&
          relationship.from === "main.ts" &&
          relationship.to === "greeting.ts:getGreeting:2",
      ),
    );
  } finally {
    rmSync(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});

test("deduplicates identical CALLS relationships", () => {
  const source = `
    function greet() {
      return "Hello";
    }

    function main() {
      greet();
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
        endLine: 9,
        endColumn: 6,
      },
    },
  ];

  const relationships = extractRelationships(
    sourceFile,
    "test.ts",
    ".",
    symbols,
  );

  const calls = relationships.filter(
    (relationship) =>
      relationship.type === "CALLS" &&
      relationship.from === "test.ts:main:6" &&
      relationship.to === "test.ts:greet:2",
  );

  assert.equal(calls.length, 1);
});

test("extracts an EXPORTS relationship for a re-exported symbol", () => {
  const repositoryPath = mkdtempSync(
    path.join(tmpdir(), "codebase-feature-mapper-"),
  );

  try {
    const greetingPath = path.join(repositoryPath, "greeting.ts");
    const indexPath = path.join(repositoryPath, "index.ts");

    writeFileSync(
      greetingPath,
      `
        export function getGreeting() {
          return "Hello";
        }
      `,
    );

    writeFileSync(
      indexPath,
      `
        export { getGreeting } from "./greeting";
      `,
    );

    const indexSourceFile = ts.createSourceFile(
      indexPath,
      readFileSync(indexPath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const knownSymbols = [
      {
        id: "greeting.ts:getGreeting:2",
        name: "getGreeting",
        type: "function" as const,
        location: {
          file: "greeting.ts",
          startLine: 2,
          startColumn: 25,
          endLine: 4,
          endColumn: 10,
        },
      },
    ];

    const relationships = extractRelationships(
      indexSourceFile,
      indexPath,
      repositoryPath,
      knownSymbols,
    );

    assert.ok(
      relationships.some(
        (relationship) =>
          relationship.type === "EXPORTS" &&
          relationship.from === "index.ts" &&
          relationship.to === "greeting.ts:getGreeting:2",
      ),
    );
  } finally {
    rmSync(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});

test("resolves namespace imports when extracting CALLS relationships", () => {
  const repositoryPath = mkdtempSync(path.join(tmpdir(), "relationship-test-"));

  try {
    const utilsPath = path.join(repositoryPath, "utils.ts");

    const mainPath = path.join(repositoryPath, "main.ts");

    writeFileSync(
      utilsPath,
      `
export function getGreeting() {
  return "Hello";
}
`.trim(),
    );

    writeFileSync(
      mainPath,
      `
import * as utils from "./utils";

export function main() {
  utils.getGreeting();
}
`.trim(),
    );

    const utilsSource = readFileSync(utilsPath, "utf8");
    const mainSource = readFileSync(mainPath, "utf8");

    const utilsSourceFile = ts.createSourceFile(
      utilsPath,
      utilsSource,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const mainSourceFile = ts.createSourceFile(
      mainPath,
      mainSource,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const knownSymbols: CodeSymbol[] = [
      {
        id: "utils.ts:getGreeting:1",
        name: "getGreeting",
        type: "function",
        location: {
          file: "utils.ts",
          startLine: 1,
          startColumn: 1,
          endLine: 3,
          endColumn: 2,
        },
      },
      {
        id: "main.ts:main:3",
        name: "main",
        type: "function",
        location: {
          file: "main.ts",
          startLine: 3,
          startColumn: 1,
          endLine: 5,
          endColumn: 2,
        },
      },
    ];

    const relationships = extractRelationships(
      mainSourceFile,
      mainPath,
      repositoryPath,
      knownSymbols,
    );

    assert.deepEqual(relationships, [
      {
        from: "main.ts",
        to: "utils.ts",
        type: "IMPORTS",
      },
      {
        from: "main.ts:main:3",
        to: "utils.ts:getGreeting:1",
        type: "CALLS",
      },
    ]);

    void utilsSourceFile;
  } finally {
    rmSync(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});

test("extracts EXPORTS relationships for export-star declarations", () => {
  const repositoryPath = mkdtempSync(path.join(tmpdir(), "relationship-test-"));

  try {
    const utilsPath = path.join(repositoryPath, "utils.ts");

    const indexPath = path.join(repositoryPath, "index.ts");

    writeFileSync(
      utilsPath,
      `
export function getGreeting() {
  return "Hello";
}
`.trim(),
    );

    writeFileSync(
      indexPath,
      `
export * from "./utils";
`.trim(),
    );

    const indexSource = readFileSync(indexPath, "utf8");

    const indexSourceFile = ts.createSourceFile(
      indexPath,
      indexSource,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    const knownSymbols: CodeSymbol[] = [
      {
        id: "utils.ts:getGreeting:1",
        name: "getGreeting",
        type: "function",
        location: {
          file: "utils.ts",
          startLine: 1,
          startColumn: 1,
          endLine: 3,
          endColumn: 2,
        },
      },
    ];

    const relationships = extractRelationships(
      indexSourceFile,
      indexPath,
      repositoryPath,
      knownSymbols,
    );

    assert.deepEqual(relationships, [
      {
        from: "index.ts",
        to: "utils.ts",
        type: "IMPORTS",
      },
      {
        from: "index.ts",
        to: "utils.ts:getGreeting:1",
        type: "EXPORTS",
      },
    ]);
  } finally {
    rmSync(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});

test("resolves default imports by their exported symbol, not their local alias", () => {
  const repositoryPath = mkdtempSync(
    path.join(tmpdir(), "codebase-feature-mapper-"),
  );

  try {
    const utilitiesDirectory = path.join(repositoryPath, "utilities");
    const greetingPath = path.join(utilitiesDirectory, "index.ts");
    const mainPath = path.join(repositoryPath, "main.ts");

    mkdirSync(utilitiesDirectory);
    writeFileSync(
      greetingPath,
      [
        "export default function createGreeting() {",
        '  return "Hello";',
        "}",
      ].join("\n"),
    );
    writeFileSync(
      mainPath,
      [
        'import makeGreeting from "./utilities";',
        "",
        "export function main() {",
        "  return makeGreeting();",
        "}",
      ].join("\n"),
    );

    const mainSourceFile = ts.createSourceFile(
      mainPath,
      readFileSync(mainPath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const knownSymbols: CodeSymbol[] = [
      {
        id: "utilities/index.ts:createGreeting:1",
        name: "createGreeting",
        type: "function",
        location: {
          file: "utilities/index.ts",
          startLine: 1,
          startColumn: 1,
          endLine: 3,
          endColumn: 2,
        },
      },
      {
        id: "main.ts:main:3",
        name: "main",
        type: "function",
        location: {
          file: "main.ts",
          startLine: 3,
          startColumn: 1,
          endLine: 5,
          endColumn: 2,
        },
      },
    ];

    const relationships = extractRelationships(
      mainSourceFile,
      mainPath,
      repositoryPath,
      knownSymbols,
    );

    assert.ok(
      relationships.some(
        (relationship) =>
          relationship.type === "CALLS" &&
          relationship.from === "main.ts:main:3" &&
          relationship.to === "utilities/index.ts:createGreeting:1",
      ),
    );
    assert.ok(
      relationships.some(
        (relationship) =>
          relationship.type === "REFERENCES" &&
          relationship.from === "main.ts" &&
          relationship.to === "utilities/index.ts:createGreeting:1",
      ),
    );
  } finally {
    rmSync(repositoryPath, { recursive: true, force: true });
  }
});
