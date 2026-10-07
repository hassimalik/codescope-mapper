import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { scanRepository } from "../src/scanner.js";

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
