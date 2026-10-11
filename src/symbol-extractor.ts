import ts from "typescript";

import { CodeSymbol, SourceLocation, SymbolType } from "./symbol.js";

export function extractSymbols(
  sourceFile: ts.SourceFile,
  filePath: string,
): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];

  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      symbols.push(
        createSymbol(node.name.text, "function", node, sourceFile, filePath),
      );
    }

    if (ts.isClassDeclaration(node) && node.name) {
      symbols.push(
        createSymbol(node.name.text, "class", node, sourceFile, filePath),
      );
    }

    if (ts.isMethodDeclaration(node) && isNamedClassDeclaration(node.parent)) {
      const parentId = getClassId(node.parent, sourceFile, filePath);

      symbols.push(
        createSymbol(
          node.name.getText(sourceFile),
          "function",
          node,
          sourceFile,
          filePath,
          parentId,
        ),
      );
    }

    if (
      ts.isConstructorDeclaration(node) &&
      isNamedClassDeclaration(node.parent)
    ) {
      const parentId = getClassId(node.parent, sourceFile, filePath);

      symbols.push(
        createSymbol(
          "constructor",
          "function",
          node,
          sourceFile,
          filePath,
          parentId,
        ),
      );
    }

    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          const type =
            declaration.initializer &&
            (ts.isArrowFunction(declaration.initializer) ||
              ts.isFunctionExpression(declaration.initializer))
              ? "function"
              : "variable";

          symbols.push(
            createSymbol(
              declaration.name.text,
              type,
              declaration,
              sourceFile,
              filePath,
            ),
          );
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return symbols;
}

function createSymbol(
  name: string,
  type: SymbolType,
  node: ts.Node,
  sourceFile: ts.SourceFile,
  filePath: string,
  parentId?: string,
): CodeSymbol {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());

  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

  const location: SourceLocation = {
    file: filePath,
    startLine: start.line + 1,
    startColumn: start.character + 1,
    endLine: end.line + 1,
    endColumn: end.character + 1,
  };

  return {
    id: parentId
      ? `${parentId}.${name}:${start.line + 1}`
      : `${filePath}:${name}:${start.line + 1}`,
    name,
    type,
    location,
    ...(parentId ? { parentId } : {}),
  };
}

function isNamedClassDeclaration(
  node: ts.Node,
): node is ts.ClassDeclaration & { name: ts.Identifier } {
  return ts.isClassDeclaration(node) && node.name !== undefined;
}

function getClassId(
  classDeclaration: ts.ClassDeclaration & { name: ts.Identifier },
  sourceFile: ts.SourceFile,
  filePath: string,
): string {
  const start = sourceFile.getLineAndCharacterOfPosition(
    classDeclaration.getStart(),
  );

  return `${filePath}:${classDeclaration.name.text}:${start.line + 1}`;
}
