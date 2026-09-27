export type RelationshipType =
  | "IMPORTS"
  | "CONTAINS";

export interface CodeRelationship {
  from: string;
  to: string;
  type: RelationshipType;
}