import type { SourceFile } from "../types/source-file.js";
import { readSourceFile } from "../reader.js";

export interface RepositoryFileDetails {
  relativePath: string;
  extension: string;
  content: string;
}

export async function readRepositoryFile(
  files: SourceFile[],
  relativePath: string,
): Promise<RepositoryFileDetails | undefined> {
  const normalizedPath = normalizeRelativePath(relativePath);
  const file = files.find(
    (candidate) =>
      normalizeRelativePath(candidate.relativePath) === normalizedPath,
  );

  if (!file) {
    return undefined;
  }

  return {
    relativePath: normalizeRelativePath(file.relativePath),
    extension: file.extension,
    content: await readSourceFile(file),
  };
}

function normalizeRelativePath(relativePath: string): string {
  return relativePath.replaceAll("\\", "/");
}
