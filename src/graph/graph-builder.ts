import path from "node:path";

import { scanRepository } from "../scanner.js";
import { readSourceFile } from "../reader.js";
import { parseSourceFile } from "../parser.js";
import { extractSymbols } from "../symbol-extractor.js";
import { extractRelationships } from "../relationship-extractor.js";
import { CodeGraph } from "./code-graph.js";
import { CodeSymbol } from "../symbol.js";

export async function buildCodeGraph(
  repositoryPath: string,
): Promise<CodeGraph> {
  const absolutePath = path.resolve(repositoryPath);

  const files = await scanRepository(absolutePath);

  const graph: CodeGraph = {
    nodes: [],
    relationships: [],
  };

  for (const file of files) {
    const source = await readSourceFile(file);
    const ast = parseSourceFile(file.path, source);

    const fileSymbol: CodeSymbol = {
      id: file.relativePath,
      name: file.relativePath,
      type: "file" as any,
      location: {
        file: file.relativePath,
        startLine: 1,
        startColumn: 1,
        endLine: source.split("\n").length,
        endColumn: 1,
      },
    };

    graph.nodes.push(fileSymbol);

    const symbols = extractSymbols(ast, file.relativePath);

    graph.nodes.push(...symbols);

    for (const symbol of symbols) {
      graph.relationships.push({
        from: fileSymbol.id,
        to: symbol.id,
        type: "CONTAINS",
      });
    }

    const relationships = extractRelationships(ast, file.path, absolutePath);

    graph.relationships.push(...relationships);
  }

  return graph;
}
