import path from "node:path";

import type { SourceFile } from "../types/source-file.js";

export type FileSearchResult = Pick<SourceFile, "relativePath" | "extension">;

export function searchRepositoryFiles(
  files: SourceFile[],
  query: string,
): FileSearchResult[] {
  const normalizedQuery = query.toLowerCase();

  return files
    .flatMap((file) => {
      const rank = getMatchRank(file, normalizedQuery);
      return rank === undefined ? [] : [{ file, rank }];
    })
    .sort((left, right) => {
      const rankDifference = left.rank - right.rank;
      if (rankDifference !== 0) {
        return rankDifference;
      }

      return compareStrings(
        normalizeRelativePath(left.file.relativePath),
        normalizeRelativePath(right.file.relativePath),
      );
    })
    .map(({ file }) => ({
      relativePath: normalizeRelativePath(file.relativePath),
      extension: file.extension,
    }));
}

function getMatchRank(
  file: SourceFile,
  normalizedQuery: string,
): number | undefined {
  if (normalizedQuery.length === 0) {
    return 0;
  }

  const relativePath = normalizeRelativePath(file.relativePath).toLowerCase();
  const fileName = relativePath.slice(relativePath.lastIndexOf("/") + 1);

  if (relativePath === normalizedQuery) {
    return 0;
  }

  if (fileName === normalizedQuery) {
    return 1;
  }

  if (fileName.includes(normalizedQuery)) {
    return 2;
  }

  const directorySegments = relativePath.split("/").slice(0, -1);
  if (directorySegments.some((segment) => segment.includes(normalizedQuery))) {
    return 3;
  }

  if (file.extension.toLowerCase().includes(normalizedQuery)) {
    return 3;
  }

  if (relativePath.includes(normalizedQuery)) {
    return 4;
  }

  return undefined;
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}
