import * as ts from "typescript";

export function parseSourceFile(
  fileName: string,
  source: string,
): ts.SourceFile {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
}
