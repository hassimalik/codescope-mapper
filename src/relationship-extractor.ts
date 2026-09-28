import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

import { CodeRelationship } from "./types/relationships.js";

export function extractRelationships(
  sourceFile: ts.SourceFile,
  filePath: string,
  repositoryPath: string,
): CodeRelationship[] {
  const relationships: CodeRelationship[] = [];

  const relativeFilePath = path.relative(repositoryPath, filePath);

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;

      if (ts.isStringLiteral(moduleSpecifier)) {
        const importPath = moduleSpecifier.text;

        relationships.push({
          from: relativeFilePath,
          to: resolveImport(importPath, filePath, repositoryPath),
          type: "IMPORTS",
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return relationships;
}

function resolveImport(
  importPath: string,
  currentFile: string,
  repositoryPath: string,
): string {
  if (!importPath.startsWith(".")) {
    return importPath;
  }

  const currentDirectory = path.dirname(currentFile);

  const possiblePaths = [
    path.resolve(currentDirectory, importPath),
    path.resolve(currentDirectory, `${importPath}.ts`),
    path.resolve(currentDirectory, `${importPath}.tsx`),
    path.resolve(currentDirectory, `${importPath}.js`),
    path.resolve(currentDirectory, `${importPath}.jsx`),
    path.resolve(currentDirectory, `${importPath}.css`),
    path.resolve(currentDirectory, importPath, "index.ts"),
    path.resolve(currentDirectory, importPath, "index.tsx"),
    path.resolve(currentDirectory, importPath, "index.js"),
    path.resolve(currentDirectory, importPath, "index.jsx"),
  ];

  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      return path.relative(repositoryPath, possiblePath);
    }
  }

  return importPath;
}
