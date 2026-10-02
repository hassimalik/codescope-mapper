import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

import { CodeSymbol } from "./symbol.js";
import { CodeRelationship } from "./types/relationships.js";

interface ImportBinding {
  localName: string;
  targetSymbol: CodeSymbol;
}

interface NamespaceImportBinding {
  localName: string;
  sourceFile: string;
}

export function extractRelationships(
  sourceFile: ts.SourceFile,
  filePath: string,
  repositoryPath: string,
  knownSymbols: CodeSymbol[],
): CodeRelationship[] {
  const relationships: CodeRelationship[] = [];
  const relationshipKeys = new Set<string>();

  const relativeFilePath = path.relative(repositoryPath, filePath);

  const importBindings = getImportBindings(
    sourceFile,
    filePath,
    repositoryPath,
    knownSymbols,
  );

  const namespaceImportBindings = getNamespaceImportBindings(
    sourceFile,
    filePath,
    repositoryPath,
  );

  function addRelationship(
    relationship: CodeRelationship,
  ): void {
    const key = [
      relationship.from,
      relationship.type,
      relationship.to,
    ].join("|");

    if (relationshipKeys.has(key)) {
      return;
    }

    relationshipKeys.add(key);
    relationships.push(relationship);
  }

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      handleImport(node);
    }

    if (ts.isExportDeclaration(node)) {
      handleExport(node);
    }

    if (ts.isCallExpression(node)) {
      handleCall(node);
    }

    ts.forEachChild(node, visit);
  }

  function handleImport(node: ts.ImportDeclaration) {
    const moduleSpecifier = node.moduleSpecifier;

    if (!ts.isStringLiteral(moduleSpecifier)) {
      return;
    }

    const importPath = moduleSpecifier.text;

    const resolvedImport = resolveImport(
      importPath,
      filePath,
      repositoryPath,
    );

    addRelationship({
      from: relativeFilePath,
      to: resolvedImport,
      type: "IMPORTS",
    });

    if (!isLocalImport(importPath)) {
      return;
    }

    const importedSymbols = getImportedSymbols(node);

    for (const importedSymbol of importedSymbols) {
      const targetSymbol = knownSymbols.find(
        (symbol) =>
          symbol.location.file === resolvedImport &&
          symbol.name === importedSymbol,
      );

      if (!targetSymbol) {
        continue;
      }

      addRelationship({
        from: relativeFilePath,
        to: targetSymbol.id,
        type: "REFERENCES",
      });
    }
  }

  function handleExport(node: ts.ExportDeclaration) {
    const exportClause = node.exportClause;

    if (!exportClause || !ts.isNamedExports(exportClause)) {
      return;
    }

    const moduleSpecifier = node.moduleSpecifier;

    if (moduleSpecifier && !ts.isStringLiteral(moduleSpecifier)) {
      return;
    }

    const resolvedExport =
      moduleSpecifier && ts.isStringLiteral(moduleSpecifier)
        ? resolveImport(
            moduleSpecifier.text,
            filePath,
            repositoryPath,
          )
        : relativeFilePath;

    for (const element of exportClause.elements) {
      const exportedName = element.name.text;
      const localName =
        element.propertyName?.text ?? exportedName;

      const targetSymbol = knownSymbols.find(
        (symbol) =>
          symbol.location.file === resolvedExport &&
          symbol.name === localName,
      );

      if (!targetSymbol) {
        continue;
      }

      addRelationship({
        from: relativeFilePath,
        to: targetSymbol.id,
        type: "EXPORTS",
      });
    }
  }

  function handleCall(node: ts.CallExpression) {
    const caller = findContainingFunction(
      node,
      sourceFile,
      relativeFilePath,
      knownSymbols,
    );

    if (!caller) {
      return;
    }

    const targetSymbol = resolveCallTarget(
      node,
      relativeFilePath,
      knownSymbols,
      importBindings,
      namespaceImportBindings,
    );

    if (!targetSymbol) {
      return;
    }

    addRelationship({
      from: caller.id,
      to: targetSymbol.id,
      type: "CALLS",
    });
  }

  visit(sourceFile);

  return relationships;
}

function resolveCallTarget(
  node: ts.CallExpression,
  relativeFilePath: string,
  knownSymbols: CodeSymbol[],
  importBindings: ImportBinding[],
  namespaceImportBindings: NamespaceImportBinding[],
): CodeSymbol | undefined {
  const expression = node.expression;

  if (ts.isIdentifier(expression)) {
    const calledName = expression.text;

    const localSymbol = knownSymbols.find(
      (symbol) =>
        symbol.type === "function" &&
        symbol.location.file === relativeFilePath &&
        symbol.name === calledName,
    );

    if (localSymbol) {
      return localSymbol;
    }

    const importedBinding = importBindings.find(
      (binding) => binding.localName === calledName,
    );

    return importedBinding?.targetSymbol;
  }

  if (ts.isPropertyAccessExpression(expression)) {
    const propertyName = expression.name.text;
    const receiver = expression.expression;

    if (ts.isIdentifier(receiver)) {
      const namespaceBinding = namespaceImportBindings.find(
        (binding) =>
          binding.localName === receiver.text &&
          binding.sourceFile !== relativeFilePath,
      );

      if (namespaceBinding) {
        const namespaceTarget = knownSymbols.find(
          (symbol) =>
            symbol.location.file ===
              namespaceBinding.sourceFile &&
            symbol.name === propertyName,
        );

        if (namespaceTarget) {
          return namespaceTarget;
        }
      }
    }

    const localSymbol = knownSymbols.find(
      (symbol) =>
        symbol.type === "function" &&
        symbol.location.file === relativeFilePath &&
        symbol.name === propertyName,
    );

    if (localSymbol) {
      return localSymbol;
    }

    const importedBinding = importBindings.find(
      (binding) => binding.localName === propertyName,
    );

    return importedBinding?.targetSymbol;
  }

  return undefined;
}

function getImportBindings(
  sourceFile: ts.SourceFile,
  filePath: string,
  repositoryPath: string,
  knownSymbols: CodeSymbol[],
): ImportBinding[] {
  const bindings: ImportBinding[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) {
      continue;
    }

    const moduleSpecifier = statement.moduleSpecifier;

    if (!ts.isStringLiteral(moduleSpecifier)) {
      continue;
    }

    const importPath = moduleSpecifier.text;

    if (!isLocalImport(importPath)) {
      continue;
    }

    const resolvedImport = resolveImport(
      importPath,
      filePath,
      repositoryPath,
    );

    const importClause = statement.importClause;

    if (!importClause) {
      continue;
    }

    if (importClause.name) {
      const importedDefaultName = importClause.name.text;

      const targetSymbol = knownSymbols.find(
        (symbol) =>
          symbol.location.file === resolvedImport &&
          symbol.name === importedDefaultName,
      );

      if (targetSymbol) {
        bindings.push({
          localName: importedDefaultName,
          targetSymbol,
        });
      }
    }

    const namedBindings = importClause.namedBindings;

    if (!namedBindings || !ts.isNamedImports(namedBindings)) {
      continue;
    }

    for (const element of namedBindings.elements) {
      const importedName =
        element.propertyName?.text ?? element.name.text;

      const localName = element.name.text;

      const targetSymbol = knownSymbols.find(
        (symbol) =>
          symbol.location.file === resolvedImport &&
          symbol.name === importedName,
      );

      if (!targetSymbol) {
        continue;
      }

      bindings.push({
        localName,
        targetSymbol,
      });
    }
  }

  return bindings;
}

function getNamespaceImportBindings(
  sourceFile: ts.SourceFile,
  filePath: string,
  repositoryPath: string,
): NamespaceImportBinding[] {
  const bindings: NamespaceImportBinding[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) {
      continue;
    }

    const moduleSpecifier = statement.moduleSpecifier;

    if (!ts.isStringLiteral(moduleSpecifier)) {
      continue;
    }

    const importPath = moduleSpecifier.text;

    if (!isLocalImport(importPath)) {
      continue;
    }

    const importClause = statement.importClause;

    if (!importClause) {
      continue;
    }

    const namedBindings = importClause.namedBindings;

    if (
      !namedBindings ||
      !ts.isNamespaceImport(namedBindings)
    ) {
      continue;
    }

    bindings.push({
      localName: namedBindings.name.text,
      sourceFile: resolveImport(
        importPath,
        filePath,
        repositoryPath,
      ),
    });
  }

  return bindings;
}

function findContainingFunction(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  relativeFilePath: string,
  knownSymbols: CodeSymbol[],
): CodeSymbol | undefined {
  const position = getNodeLocation(
    node,
    sourceFile,
    relativeFilePath,
  );

  const candidates = knownSymbols.filter((symbol) => {
    if (symbol.type !== "function") {
      return false;
    }

    if (symbol.location.file !== relativeFilePath) {
      return false;
    }

    return isLocationInside(position, symbol);
  });

  candidates.sort(
    (a, b) => getLocationSize(a) - getLocationSize(b),
  );

  return candidates[0];
}

function getLocationSize(symbol: CodeSymbol): number {
  const location = symbol.location;

  return (
    (location.endLine - location.startLine) * 1000 +
    (location.endColumn - location.startColumn)
  );
}

function getNodeLocation(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  filePath: string,
) {
  const start = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  );

  const end = sourceFile.getLineAndCharacterOfPosition(
    node.getEnd(),
  );

  return {
    file: filePath,
    startLine: start.line + 1,
    startColumn: start.character + 1,
    endLine: end.line + 1,
    endColumn: end.character + 1,
  };
}

function isLocationInside(
  location: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  },
  symbol: CodeSymbol,
): boolean {
  const symbolLocation = symbol.location;

  const startsAfterSymbol =
    location.startLine > symbolLocation.startLine ||
    (location.startLine === symbolLocation.startLine &&
      location.startColumn >= symbolLocation.startColumn);

  const endsBeforeSymbol =
    location.endLine < symbolLocation.endLine ||
    (location.endLine === symbolLocation.endLine &&
      location.endColumn <= symbolLocation.endColumn);

  return startsAfterSymbol && endsBeforeSymbol;
}

function getImportedSymbols(
  node: ts.ImportDeclaration,
): string[] {
  const importClause = node.importClause;

  if (!importClause) {
    return [];
  }

  const symbols: string[] = [];

  if (importClause.name) {
    symbols.push(importClause.name.text);
  }

  const namedBindings = importClause.namedBindings;

  if (namedBindings && ts.isNamedImports(namedBindings)) {
    for (const element of namedBindings.elements) {
      symbols.push(
        element.propertyName?.text ?? element.name.text,
      );
    }
  }

  return symbols;
}

function isLocalImport(importPath: string): boolean {
  return importPath.startsWith(".");
}

function resolveImport(
  importPath: string,
  currentFile: string,
  repositoryPath: string,
): string {
  if (!isLocalImport(importPath)) {
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
    path.resolve(
      currentDirectory,
      importPath,
      "index.ts",
    ),
    path.resolve(
      currentDirectory,
      importPath,
      "index.tsx",
    ),
    path.resolve(
      currentDirectory,
      importPath,
      "index.js",
    ),
    path.resolve(
      currentDirectory,
      importPath,
      "index.jsx",
    ),
  ];

  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      return path.relative(repositoryPath, possiblePath);
    }
  }

  return importPath;
}

