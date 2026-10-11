import type { SourceFile } from "./types/source-file.js";

import { readdir } from "node:fs/promises";
import path from "node:path";

const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
]);

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
]);

const IGNORED_FILES = new Set(["next-env.d.ts"]);

export interface RepositoryScan {
  files: SourceFile[];
  directories: string[];
  unreadableDirectories: string[];
}

export async function scanRepository(directory: string): Promise<SourceFile[]> {
  const scan = await scanRepositoryTree(directory);
  return scan.files;
}

export async function scanRepositoryTree(
  directory: string,
): Promise<RepositoryScan> {
  const files: SourceFile[] = [];
  const directories: string[] = [];
  const unreadableDirectories: string[] = [];

  async function walk(currentDirectory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(currentDirectory, {
        withFileTypes: true,
      });
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? error.code
          : undefined;
      if (
        currentDirectory !== directory &&
        (code === "EACCES" || code === "EPERM")
      ) {
        unreadableDirectories.push(
          toRepositoryPath(directory, currentDirectory),
        );
        return;
      }

      throw error;
    }

    entries.sort((left, right) => left.name.localeCompare(right.name));

    for (const entry of entries) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      if (entry.isFile() && IGNORED_FILES.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        directories.push(toRepositoryPath(directory, fullPath));
        await walk(fullPath);
        continue;
      }

      if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        files.push({
          path: fullPath,
          relativePath: toRepositoryPath(directory, fullPath),
          extension: path.extname(fullPath),
        });
      }
    }
  }

  await walk(directory);

  files.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );

  directories.sort((left, right) => left.localeCompare(right));
  unreadableDirectories.sort((left, right) => left.localeCompare(right));

  return {
    files,
    directories,
    unreadableDirectories,
  };
}

function toRepositoryPath(repositoryPath: string, filePath: string): string {
  return path.relative(repositoryPath, filePath).split(path.sep).join("/");
}
