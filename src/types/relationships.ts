export type RelationshipType =
  "IMPORTS" | "CONTAINS" | "REFERENCES" | "CALLS" | "EXPORTS";

export interface CodeRelationship {
  from: string;
  to: string;
  type: RelationshipType;
}
