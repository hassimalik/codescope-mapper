export type RelationshipType =
  | "IMPORTS";

export interface CodeRelationship {
  from: string;
  to: string;
  type: RelationshipType;
}