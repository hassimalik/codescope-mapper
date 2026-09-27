import path from "node:path";

import { scanRepository } from "./scanner.js";
import { readSourceFile } from "./reader.js";
import { parseSourceFile } from "./parser.js";
import { extractSymbols } from "./symbol-extractor.js";
import { extractRelationships } from "./relationship-extractor.js";
import { CodeGraph } from "./graph/code-graph.js";
import { CodeSymbol } from "./symbol.js";

const args = process.argv.slice(2);
const repositoryPath = args[0];

if (!repositoryPath) {
  console.error("Please provide a repository path.");
  process.exit(1);
}

const absolutePath = path.resolve(repositoryPath);

async function main() {
  const files = await scanRepository(absolutePath);

  console.log(`Found ${files.length} source files:\n`);

  const graph: CodeGraph = {
    nodes: [],
    relationships: [],
  };

  for (const file of files) {
    const source = await readSourceFile(file);
    const ast = parseSourceFile(file.path, source);

    console.log(`\n${file.relativePath}`);

    const fileSymbol = {
      id: file.relativePath,
      name: file.relativePath,
      type: "file" as CodeSymbol["type"],
      location: {
        file: file.relativePath,
        startLine: 1,
        startColumn: 1,
        endLine: source.split("\n").length,
        endColumn: 1,
      },
    } as CodeSymbol;

    graph.nodes.push(fileSymbol);

    console.log(`  file: ${file.relativePath}`);

    const symbols = extractSymbols(
      ast,
      file.relativePath,
    );

    graph.nodes.push(...symbols);

    for (const symbol of symbols) {
      console.log(
        `  ${symbol.type}: ${symbol.name} (line ${symbol.location.startLine})`,
      );

      graph.relationships.push({
        from: fileSymbol.id,
        to: symbol.id,
        type: "CONTAINS",
      });
    }

    const relationships = extractRelationships(
      ast,
      file.path,
      absolutePath,
    );

    graph.relationships.push(...relationships);

    for (const relationship of relationships) {
      console.log(
        `  ${relationship.type}: ${relationship.from} → ${relationship.to}`,
      );
    }
  }

  console.log("\nCodeGraph");
  console.log(`Nodes: ${graph.nodes.length}`);
  console.log(`Relationships: ${graph.relationships.length}`);
}

main();