import type { SourceFile } from "./types/source-file.js";

import { readdir } from "node:fs/promises";
import path from "node:path";

const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
]);

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
]);

const IGNORED_FILES = new Set([
  "next-env.d.ts",
]);

export async function scanRepository(
  directory: string,
): Promise<SourceFile[]> {
  const files: SourceFile[] = [];

  async function walk(currentDirectory: string): Promise<void> {
    const entries = await readdir(currentDirectory, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      if (
        entry.isDirectory() &&
        IGNORED_DIRECTORIES.has(entry.name)
      ) {
        continue;
      }

      if (
        entry.isFile() &&
        IGNORED_FILES.has(entry.name)
      ) {
        continue;
      }

      const fullPath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (
        entry.isFile() &&
        SOURCE_EXTENSIONS.has(path.extname(entry.name))
      ) {
        files.push({
          path: fullPath,
          relativePath: path.relative(directory, fullPath),
          extension: path.extname(fullPath),
        });
      }
    }
  }

  await walk(directory);

  return files;
}