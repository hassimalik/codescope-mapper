import { readFile } from "node:fs/promises";
import type { SourceFile } from "./types/source-file.js";

export async function readSourceFile(
  file: SourceFile,
): Promise<string> {
  return readFile(file.path, "utf8");
}