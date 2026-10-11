import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { scanRepository, scanRepositoryTree } from "../src/scanner.js";

test("scans modern JavaScript and TypeScript module extensions", async () => {
  const repositoryPath = mkdtempSync(
    path.join(tmpdir(), "codebase-feature-mapper-"),
  );

  try {
    for (const extension of [".js", ".mjs", ".cjs", ".ts", ".mts", ".cts"]) {
      writeFileSync(
        path.join(repositoryPath, `module${extension}`),
        "export {};\n",
      );
    }
    writeFileSync(path.join(repositoryPath, "notes.md"), "not source\n");

    const files = await scanRepository(repositoryPath);

    assert.deepEqual(
      files.map((file) => file.relativePath),
      [
        "module.cjs",
        "module.cts",
        "module.js",
        "module.mjs",
        "module.mts",
        "module.ts",
      ],
    );
  } finally {
    rmSync(repositoryPath, { recursive: true, force: true });
  }
});

test("returns supported files and empty navigable directories without ignored paths", async () => {
  const repositoryPath = mkdtempSync(
    path.join(tmpdir(), "codebase-feature-mapper-"),
  );

  try {
    mkdirSync(path.join(repositoryPath, "src", "empty"), { recursive: true });
    mkdirSync(path.join(repositoryPath, "node_modules", "ignored"), {
      recursive: true,
    });
    writeFileSync(path.join(repositoryPath, "src", "main.ts"), "export {};\n");
    writeFileSync(
      path.join(repositoryPath, "node_modules", "ignored", "dependency.ts"),
      "export {};\n",
    );

    const scan = await scanRepositoryTree(repositoryPath);

    assert.deepEqual(
      scan.files.map((file) => file.relativePath),
      ["src/main.ts"],
    );
    assert.deepEqual(scan.directories, ["src", "src/empty"]);
    assert.deepEqual(scan.unreadableDirectories, []);
    assert.deepEqual(
      (await scanRepository(repositoryPath)).map((file) => file.relativePath),
      ["src/main.ts"],
    );
  } finally {
    rmSync(repositoryPath, { recursive: true, force: true });
  }
});
