import path from "node:path";

import { parseSourceFile } from "../parser.js";
import { readSourceFile } from "../reader.js";
import { extractRelationships } from "../relationship-extractor.js";
import { scanRepository } from "../scanner.js";
import { CodeSymbol } from "../symbol.js";
import { extractSymbols } from "../symbol-extractor.js";
import { CodeGraph } from "./code-graph.js";
import { validateCodeGraph } from "./graph-validator.js";

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

  const seenNodes = new Set<string>();
  const seenRelationships = new Set<string>();

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

    if (!seenNodes.has(fileSymbol.id)) {
      seenNodes.add(fileSymbol.id);
      graph.nodes.push(fileSymbol);
    }

    const symbols = extractSymbols(file.ast, file.relativePath);

    for (const symbol of symbols) {
      if (!seenNodes.has(symbol.id)) {
        seenNodes.add(symbol.id);
        graph.nodes.push(symbol);
      }

      const relationshipKey = [fileSymbol.id, "CONTAINS", symbol.id].join("|");
      if (!seenRelationships.has(relationshipKey)) {
        seenRelationships.add(relationshipKey);
        graph.relationships.push({
          from: fileSymbol.id,
          to: symbol.id,
          type: "CONTAINS",
        });
      }
    }
  }

  for (const file of parsedFiles) {
    const relationships = extractRelationships(
      file.ast,
      file.path,
      absolutePath,
      graph.nodes,
    );

    for (const relationship of relationships) {
      const relationshipKey = [
        relationship.from,
        relationship.type,
        relationship.to,
      ].join("|");

      if (seenRelationships.has(relationshipKey)) {
        continue;
      }

      seenRelationships.add(relationshipKey);
      graph.relationships.push(relationship);
    }
  }

  graph.nodes.sort((left, right) => left.id.localeCompare(right.id));
  graph.relationships.sort((left, right) => {
    const leftKey = [left.from, left.type, left.to].join("|");
    const rightKey = [right.from, right.type, right.to].join("|");

    return leftKey.localeCompare(rightKey);
  });

  const validationErrors = validateCodeGraph(graph);

  if (validationErrors.length > 0) {
    throw new Error(
      [
        "CodeGraph validation failed:",
        ...validationErrors.map((error) => `- ${error}`),
      ].join("\n"),
    );
  }

  return graph;
}
