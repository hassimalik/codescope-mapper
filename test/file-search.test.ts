import { strict as assert } from "node:assert";
import { test } from "node:test";

import { searchRepositoryFiles } from "../src/explorer/file-search.js";
import type { SourceFile } from "../src/types/source-file.js";

const files: SourceFile[] = [
  {
    path: "/private/repository/src/components/LoginForm.tsx",
    relativePath: "src/components/LoginForm.tsx",
    extension: ".tsx",
  },
  {
    path: "/private/repository/src/auth/useAuth.ts",
    relativePath: "src/auth/useAuth.ts",
    extension: ".ts",
  },
  {
    path: "/private/repository/src/auth/handlers.ts",
    relativePath: "src/auth/handlers.ts",
    extension: ".ts",
  },
  {
    path: "/private/repository/src/api/auth.ts",
    relativePath: "src/api/auth.ts",
    extension: ".ts",
  },
  {
    path: "/private/repository/src/auth/AuthService.ts",
    relativePath: "src/auth/AuthService.ts",
    extension: ".ts",
  },
  {
    path: "/private/repository/src/types/User.ts",
    relativePath: "src/types/User.ts",
    extension: ".ts",
  },
];

test("ranks exact relative-path matches first", () => {
  assert.deepEqual(searchRepositoryFiles(files, "src/auth/AuthService.ts")[0], {
    relativePath: "src/auth/AuthService.ts",
    extension: ".ts",
  });
});

test("matches partial filenames", () => {
  assert.deepEqual(
    searchRepositoryFiles(files, "LoginForm").map((file) => file.relativePath),
    ["src/components/LoginForm.tsx"],
  );
});

test("matches exact filenames", () => {
  assert.deepEqual(
    searchRepositoryFiles(files, "AuthService.ts").map(
      (file) => file.relativePath,
    ),
    ["src/auth/AuthService.ts"],
  );
});

test("matches directory path segments", () => {
  assert.deepEqual(
    searchRepositoryFiles(files, "components").map((file) => file.relativePath),
    ["src/components/LoginForm.tsx"],
  );
});

test("search is case-insensitive", () => {
  assert.deepEqual(
    searchRepositoryFiles(files, "AUTHservice").map(
      (file) => file.relativePath,
    ),
    ["src/auth/AuthService.ts"],
  );
});

test("matches file extensions", () => {
  assert.deepEqual(
    searchRepositoryFiles(files, ".tsx").map((file) => file.relativePath),
    ["src/components/LoginForm.tsx"],
  );
});

test("returns all repository files for an empty query in path order", () => {
  assert.deepEqual(
    searchRepositoryFiles(files, "").map((file) => file.relativePath),
    [
      "src/api/auth.ts",
      "src/auth/AuthService.ts",
      "src/auth/handlers.ts",
      "src/auth/useAuth.ts",
      "src/components/LoginForm.tsx",
      "src/types/User.ts",
    ],
  );
});

test("orders equal-ranked results deterministically", () => {
  assert.deepEqual(
    searchRepositoryFiles(files, "auth").map((file) => file.relativePath),
    [
      "src/api/auth.ts",
      "src/auth/AuthService.ts",
      "src/auth/useAuth.ts",
      "src/auth/handlers.ts",
    ],
  );
});

test("returns no results when nothing matches", () => {
  assert.deepEqual(searchRepositoryFiles(files, "billing"), []);
});

test("returns only relative paths and extensions, not filesystem paths", () => {
  const results = searchRepositoryFiles(files, "auth");

  assert.ok(
    results.every(
      (result) =>
        !result.relativePath.startsWith("/") && !Object.hasOwn(result, "path"),
    ),
  );
  assert.ok(results.every((result) => result.extension.startsWith(".")));
});
