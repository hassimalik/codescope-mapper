import { buildCodeGraph } from "./graph/graph-builder.js";

const args = process.argv.slice(2);
const repositoryPath = args[0];

if (!repositoryPath) {
  console.error("Please provide a repository path.");
  process.exit(1);
}

async function main() {
  const graph = await buildCodeGraph(repositoryPath);

  console.log("\nCodeGraph");

  for (const node of graph.nodes) {
    console.log(`  ${node.type}: ${node.name}`);
  }

  for (const relationship of graph.relationships) {
    console.log(
      `  ${relationship.type}: ${relationship.from} → ${relationship.to}`,
    );
  }

  console.log(`\nNodes: ${graph.nodes.length}`);
  console.log(`Relationships: ${graph.relationships.length}`);
}

main();
