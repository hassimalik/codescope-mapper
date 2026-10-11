import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  getParentDirectory,
  listDirectoryEntries,
} from "../src/explorer/file-tree.js";
import type { SourceFile } from "../src/types/source-file.js";

const files: SourceFile[] = [
  {
    path: "/repo/src/auth/login.ts",
    relativePath: "src/auth/login.ts",
    extension: ".ts",
  },
  {
    path: "/repo/src/auth/session.ts",
    relativePath: "src/auth/session.ts",
    extension: ".ts",
  },
  {
    path: "/repo/src/index.ts",
    relativePath: "src/index.ts",
    extension: ".ts",
  },
  {
    path: "/repo/README.md",
    relativePath: "README.md",
    extension: ".md",
  },
];

test("lists immediate files and directories with directories first", () => {
  assert.deepEqual(listDirectoryEntries(files, ""), [
    {
      name: "src",
      relativePath: "src",
      type: "directory",
    },
    {
      name: "README.md",
      relativePath: "README.md",
      type: "file",
      extension: ".md",
    },
  ]);
});

test("lists only immediate children for a nested directory", () => {
  assert.deepEqual(listDirectoryEntries(files, "src"), [
    {
      name: "auth",
      relativePath: "src/auth",
      type: "directory",
    },
    {
      name: "index.ts",
      relativePath: "src/index.ts",
      type: "file",
      extension: ".ts",
    },
  ]);
});

test("returns an empty listing for directories with no scanned source files", () => {
  assert.deepEqual(listDirectoryEntries(files, "src/auth/empty"), []);
});

test("includes known empty directories in the navigable directory listing", () => {
  assert.deepEqual(
    listDirectoryEntries(files, "src", ["src/auth", "src/empty"]),
    [
      {
        name: "auth",
        relativePath: "src/auth",
        type: "directory",
      },
      {
        name: "empty",
        relativePath: "src/empty",
        type: "directory",
      },
      {
        name: "index.ts",
        relativePath: "src/index.ts",
        type: "file",
        extension: ".ts",
      },
    ],
  );
});

test("returns the parent path and safely remains at the repository root", () => {
  assert.equal(getParentDirectory("src/auth"), "src");
  assert.equal(getParentDirectory("src"), "");
  assert.equal(getParentDirectory(""), "");
});
