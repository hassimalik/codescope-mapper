import { CodeSymbol } from "../symbol.js";
import { CodeRelationship } from "../types/relationships.js";

export interface CodeGraph {
  nodes: CodeSymbol[];
  relationships: CodeRelationship[];
}