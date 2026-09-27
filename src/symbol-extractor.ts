import ts from "typescript";
import { CodeSymbol, SourceLocation, SymbolType } from "./symbol";

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

    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          symbols.push(
            createSymbol(
              declaration.name.text,
              "variable",
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
    id: `${filePath}:${name}:${start.line + 1}`,
    name,
    type,
    location,
  };
}
