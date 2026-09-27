import path from "node:path";

import { scanRepository } from "./scanner.js";
import { readSourceFile } from "./reader.js";
import { parseSourceFile } from "./parser.js";
import { extractSymbols } from "./symbol-extractor.js";

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

  for (const file of files) {
    const source = await readSourceFile(file);
    const ast = parseSourceFile(file.path, source);

    console.log(`\n${file.relativePath}`);

    const symbols = extractSymbols(ast, file.path);

    for (const symbol of symbols) {
      console.log(
        `  ${symbol.type}: ${symbol.name} (line ${symbol.location.startLine})`,
      );
    }
  }
}

main();