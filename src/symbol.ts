export type SymbolType =
  "file" | "function" | "class" | "variable" | "import" | "export";

export interface SourceLocation {
  file: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface CodeSymbol {
  id: string;
  name: string;
  type: SymbolType;
  location: SourceLocation;
}
