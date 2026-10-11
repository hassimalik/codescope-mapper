import { strict as assert } from "node:assert";
import path from "node:path";
import { test } from "node:test";

import { readRepositoryFile } from "../src/explorer/file-details.js";
import type { SourceFile } from "../src/types/source-file.js";

const servicesFile: SourceFile = {
  path: path.resolve("test-fixtures/relationship-repository/src/services.ts"),
  relativePath: "src/services.ts",
  extension: ".ts",
};

test("reads a selected repository file without returning its absolute path", async () => {
  const details = await readRepositoryFile([servicesFile], "src/services.ts");

  assert.ok(details);
  assert.deepEqual(Object.keys(details).sort(), [
    "content",
    "extension",
    "relativePath",
  ]);
  assert.equal(details.relativePath, "src/services.ts");
  assert.equal(details.extension, ".ts");
  assert.match(details.content, /export class AuthService/);
});

test("accepts platform-independent separators when selecting a file", async () => {
  const details = await readRepositoryFile([servicesFile], "src\\services.ts");

  assert.equal(details?.relativePath, "src/services.ts");
});

test("does not select files by absolute filesystem path", async () => {
  const details = await readRepositoryFile([servicesFile], servicesFile.path);

  assert.equal(details, undefined);
});

test("returns undefined for unknown repository-relative paths", async () => {
  const details = await readRepositoryFile([servicesFile], "src/missing.ts");

  assert.equal(details, undefined);
});
