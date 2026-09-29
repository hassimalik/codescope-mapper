export type RelationshipType = "IMPORTS" | "CONTAINS" | "REFERENCES" | "CALLS";

export interface CodeRelationship {
  from: string;
  to: string;
  type: RelationshipType;
}
