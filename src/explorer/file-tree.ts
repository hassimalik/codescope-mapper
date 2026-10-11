import path from "node:path";

import type { SourceFile } from "../types/source-file.js";

export interface FileTreeEntry {
  name: string;
  relativePath: string;
  type: "directory" | "file";
  extension?: string;
}

export function listDirectoryEntries(
  files: SourceFile[],
  currentDirectory: string,
  directories: string[] = [],
): FileTreeEntry[] {
  const normalizedDirectory = normalizePath(currentDirectory);
  const prefix = normalizedDirectory ? `${normalizedDirectory}/` : "";
  const entries = new Map<string, FileTreeEntry>();

  for (const directory of directories) {
    const relativePath = normalizePath(directory);
    if (
      !relativePath.startsWith(prefix) ||
      relativePath === normalizedDirectory
    ) {
      continue;
    }

    const remainder = relativePath.slice(prefix.length);
    if (!remainder) {
      continue;
    }

    const separator = remainder.indexOf("/");
    const name = separator < 0 ? remainder : remainder.slice(0, separator);
    const childPath = prefix + name;
    entries.set(childPath, {
      name,
      relativePath: childPath,
      type: "directory",
    });
  }

  for (const file of files) {
    const relativePath = normalizePath(file.relativePath);
    if (!relativePath.startsWith(prefix)) {
      continue;
    }

    const remainder = relativePath.slice(prefix.length);
    if (!remainder) {
      continue;
    }

    const separator = remainder.indexOf("/");
    if (separator >= 0) {
      const name = remainder.slice(0, separator);
      const directoryPath = prefix + name;
      entries.set(directoryPath, {
        name,
        relativePath: directoryPath,
        type: "directory",
      });
      continue;
    }

    entries.set(relativePath, {
      name: remainder,
      relativePath,
      type: "file",
      extension: file.extension,
    });
  }

  return Array.from(entries.values()).sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === "directory" ? -1 : 1;
    }

    return comparePaths(left.name, right.name);
  });
}

export function getParentDirectory(currentDirectory: string): string {
  const normalizedDirectory = normalizePath(currentDirectory);
  if (!normalizedDirectory) {
    return "";
  }

  const parent = path.posix.dirname(normalizedDirectory);
  return parent === "." ? "" : parent;
}

function normalizePath(value: string): string {
  return value
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+$/, "");
}

function comparePaths(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
