import path from "node:path";

import { parseSourceFile } from "../parser.js";
import { readSourceFile } from "../reader.js";
import { extractRelationships } from "../relationship-extractor.js";
import { scanRepository } from "../scanner.js";
import { CodeSymbol } from "../symbol.js";
import { extractSymbols } from "../symbol-extractor.js";
import { CodeGraph } from "./code-graph.js";

interface ParsedFile {
  path: string;
  relativePath: string;
  source: string;
  ast: ReturnType<typeof parseSourceFile>;
}

export async function buildCodeGraph(
  repositoryPath: string,
): Promise<CodeGraph> {
  const absolutePath = path.resolve(repositoryPath);

  const files = await scanRepository(absolutePath);

  const parsedFiles: ParsedFile[] = [];

  for (const file of files) {
    const source = await readSourceFile(file);

    const ast = parseSourceFile(file.path, source);

    parsedFiles.push({
      path: file.path,
      relativePath: file.relativePath,
      source,
      ast,
    });
  }

  const graph: CodeGraph = {
    nodes: [],
    relationships: [],
  };

  for (const file of parsedFiles) {
    const fileSymbol: CodeSymbol = {
      id: file.relativePath,
      name: file.relativePath,
      type: "file",
      location: {
        file: file.relativePath,
        startLine: 1,
        startColumn: 1,
        endLine: file.source.split("\n").length,
        endColumn: 1,
      },
    };

    graph.nodes.push(fileSymbol);

    const symbols = extractSymbols(file.ast, file.relativePath);

    graph.nodes.push(...symbols);

    for (const symbol of symbols) {
      graph.relationships.push({
        from: fileSymbol.id,
        to: symbol.id,
        type: "CONTAINS",
      });
    }
  }

  for (const file of parsedFiles) {
    const relationships = extractRelationships(
      file.ast,
      file.path,
      absolutePath,
      graph.nodes,
    );

    graph.relationships.push(...relationships);
  }

  return graph;
}
