import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const projectRoot = process.cwd();
const tsxCli = path.join(projectRoot, "node_modules/tsx/dist/cli.mjs");
const cliEntry = path.join(projectRoot, "src/index.ts");

function createRepository(): string {
  const repositoryPath = mkdtempSync(path.join(tmpdir(), "codescope-cli-"));

  writeRepositoryFile(
    repositoryPath,
    "src/auth/login.ts",
    `import { findUser } from "../users/service";

export function login() {
  return findUser();
}

export { login };
`,
  );
  writeRepositoryFile(
    repositoryPath,
    "src/users/service.ts",
    `export function findUser() {
  return undefined;
}
`,
  );
  writeRepositoryFile(
    repositoryPath,
    "src/products/catalog.ts",
    `export class Catalog {
  list() {
    return [];
  }
}
`,
  );

  return repositoryPath;
}

function writeRepositoryFile(
  repositoryPath: string,
  relativePath: string,
  content: string,
): void {
  const filePath = path.join(repositoryPath, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function runCli(...args: string[]) {
  return spawnSync(
    process.execPath,
    [tsxCli, cliEntry, ...args, "--no-color"],
    {
      cwd: projectRoot,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    },
  );
}

test("prints accurate repository summary counts and a visible group limit", () => {
  const repositoryPath = createRepository();

  try {
    const jsonResult = runCli(repositoryPath, "--json");
    assert.equal(jsonResult.status, 0, jsonResult.stderr);
    const json = JSON.parse(jsonResult.stdout) as {
      summary: {
        totalFeatures: number;
        totalFiles: number;
        totalSymbols: number;
      };
      features: Array<{ files: string[]; symbols: string[] }>;
      graph: { nodes: number; relationships: number };
    };

    assert.equal(json.summary.totalFeatures, 3);
    assert.equal(json.summary.totalFiles, 3);
    assert.equal(
      json.summary.totalFiles,
      json.features.reduce((sum, group) => sum + group.files.length, 0),
    );
    assert.equal(
      json.summary.totalSymbols,
      json.features.reduce((sum, group) => sum + group.symbols.length, 0),
    );

    const summaryResult = runCli(repositoryPath, "--max-depth", "1");
    assert.equal(summaryResult.status, 0, summaryResult.stderr);
    assert.match(summaryResult.stdout, /CodeScope Mapper/);
    assert.match(summaryResult.stdout, /ANALYSIS OVERVIEW/);
    assert.match(summaryResult.stdout, /Source files analyzed\s+: 3/);
    assert.match(
      summaryResult.stdout,
      new RegExp(`Relationships found\\s+: ${json.graph.relationships}`),
    );
    assert.match(summaryResult.stdout, /Code groups detected\s+: 3/);
    assert.match(summaryResult.stdout, /Showing 1 of 3 groups/);
    assert.match(summaryResult.stdout, /NEXT STEPS/);
    assert.doesNotMatch(summaryResult.stdout, /node_modules|react/);
  } finally {
    rmSync(repositoryPath, { recursive: true, force: true });
  }
});

test("reports an empty repository without creating empty code groups", () => {
  const repositoryPath = mkdtempSync(path.join(tmpdir(), "codescope-empty-"));

  try {
    const result = runCli(repositoryPath);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Source files analyzed\s+: 0/);
    assert.match(result.stdout, /Symbols discovered\s+: 0/);
    assert.match(result.stdout, /Relationships found\s+: 0/);
    assert.match(result.stdout, /Code groups detected\s+: 0/);
    assert.match(result.stdout, /No code groups found/);
  } finally {
    rmSync(repositoryPath, { recursive: true, force: true });
  }
});

test("prints graph nodes and understandable relationship labels", () => {
  const repositoryPath = createRepository();

  try {
    const result = runCli(repositoryPath, "--graph");

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /CODE NODES/);
    assert.match(result.stdout, /CODE RELATIONSHIPS/);
    assert.match(result.stdout, /Imports:/);
    assert.match(result.stdout, /Calls:/);
    assert.match(result.stdout, /References:/);
    assert.match(result.stdout, /Contains:/);
    assert.match(result.stdout, /Exports:/);
    assert.match(
      result.stdout,
      /Imports: src\/auth\/login\.ts -> src\/users\/service\.ts/,
    );
    assert.match(result.stdout, /Calls: src\/auth\/login\.ts:login:3 ->/);
    assert.match(result.stdout, /Relationships: \d+/);
  } finally {
    rmSync(repositoryPath, { recursive: true, force: true });
  }
});

test("preserves file search and repository-relative file inspection", () => {
  const repositoryPath = createRepository();

  try {
    const searchResult = runCli(repositoryPath, "--search", "login");
    assert.equal(searchResult.status, 0, searchResult.stderr);
    assert.match(searchResult.stdout, /src\/auth\/login\.ts/);

    const noMatchesResult = runCli(
      repositoryPath,
      "--search",
      "does-not-exist",
    );
    assert.equal(noMatchesResult.status, 0, noMatchesResult.stderr);
    assert.match(noMatchesResult.stdout, /No matching files/);

    const fileResult = runCli(repositoryPath, "--file", "src/auth/login.ts");
    assert.equal(fileResult.status, 0, fileResult.stderr);
    assert.match(fileResult.stdout, /File: src\/auth\/login\.ts/);
    assert.match(fileResult.stdout, /return findUser\(\)/);
  } finally {
    rmSync(repositoryPath, { recursive: true, force: true });
  }
});

test("documents supported options, defaults, and grouping limitations in help", () => {
  const result = runCli("--help");

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /CodeScope Mapper/);
  assert.match(result.stdout, /summary.*default/);
  assert.match(result.stdout, /not business features/);
  assert.match(result.stdout, /--explore/);
  assert.match(result.stdout, /--search/);
  assert.match(result.stdout, /--file/);
  assert.match(result.stdout, /--graph/);
  assert.match(result.stdout, /--json/);
});

test("reports missing repository paths as errors", () => {
  const parentDirectory = mkdtempSync(
    path.join(tmpdir(), "codescope-missing-"),
  );
  const missingRepository = path.join(parentDirectory, "missing");

  try {
    const result = runCli(missingRepository);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Failed to map repository:/);
  } finally {
    rmSync(parentDirectory, { recursive: true, force: true });
  }
});

test("reports interactive mode's terminal requirement when not attached to a TTY", () => {
  const repositoryPath = createRepository();

  try {
    const result = runCli(repositoryPath, "--explore");

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /requires an interactive terminal/);
  } finally {
    rmSync(repositoryPath, { recursive: true, force: true });
  }
});
