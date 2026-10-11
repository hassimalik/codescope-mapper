#!/usr/bin/env node

import path from "node:path";
import { parseArgs } from "node:util";

import { Terminal, type ColorMode } from "./cli/terminal.js";
import { readRepositoryFile } from "./explorer/file-details.js";
import { searchRepositoryFiles } from "./explorer/file-search.js";
import { runInteractiveExplorer } from "./cli/interactive-explorer.js";
import { buildFeatureMap } from "./feature-mapper.js";
import {
  buildCodeGraph,
  buildCodeGraphFromFiles,
} from "./graph/graph-builder.js";
import { scanRepository, scanRepositoryTree } from "./scanner.js";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    help: {
      type: "boolean",
      short: "h",
    },
    json: {
      type: "boolean",
      short: "j",
    },
    graph: {
      type: "boolean",
    },
    summary: {
      type: "boolean",
    },
    format: {
      type: "string",
      choices: ["text", "json"],
    },
    "max-depth": {
      type: "string",
    },
    search: {
      type: "string",
    },
    file: {
      type: "string",
    },
    explore: {
      type: "boolean",
    },
    color: {
      type: "string",
      choices: ["auto", "always", "never"],
      default: "auto",
    },
    "no-color": {
      type: "boolean",
    },
  },
});

const colorMode: ColorMode = values["no-color"]
  ? "never"
  : (values.color as ColorMode);
const terminal = new Terminal(colorMode, process.stdout);
const errorTerminal = new Terminal(colorMode, process.stderr);

function printUsage(): void {
  console.log(`${terminal.heading("CodeScope Mapper")}

Usage:
  codescope-mapper <repository-path> [options]

By default, scans the repository and prints a summary of directory-derived
code groups. These groups describe code structure, not business features.

Explore a repository:
  --explore                Browse directories and inspect source files (TTY required)
  --search <query>         Search repository-relative file paths
  --file <relative-path>   Display a repository file and its source text

Map a repository:
  --summary                Print the code-group summary (default)
  --graph                  Print graph nodes and all relationships
  --json, -j               Output analysis data as JSON
  --format <text|json>     Select the summary or JSON output format
  --max-depth <number>     Limit how many code groups are listed

Display:
  --color <mode>           Color mode: auto (default), always, or never
  --no-color               Disable color (also respects NO_COLOR)
  -h, --help               Show this help text

Examples:
  codescope-mapper /path/to/repository
  codescope-mapper . --explore
  codescope-mapper . --search CodeGraph
  codescope-mapper . --graph
  codescope-mapper . --json
  codescope-mapper . --file src/auth/service.ts

Explorer keys:
  ↑/↓ move  Enter open  / search  Backspace parent  Esc back  q quit

--search matches repository-relative file paths, not symbol contents.
For scripts without a TTY, use --search or --file instead of --explore.
`);
}

function printFeatureSummary(
  featureMap: ReturnType<typeof buildFeatureMap>,
  graph: Awaited<ReturnType<typeof buildCodeGraph>>,
  repositoryPath: string,
  maxDepth: number,
): void {
  const visibleGroups = featureMap.features.slice(0, maxDepth);

  console.log(`\n${terminal.heading("CodeScope Mapper")}`);
  console.log(`${terminal.muted("=".repeat("CodeScope Mapper".length))}\n`);
  console.log(`${terminal.label("Repository:")} ${repositoryPath}\n`);
  console.log(terminal.heading("ANALYSIS OVERVIEW"));
  printMetric(
    "Source files analyzed",
    graph.nodes.filter((node) => node.type === "file").length,
  );
  printMetric(
    "Symbols discovered",
    graph.nodes.filter((node) => node.type !== "file").length,
  );
  printMetric("Relationships found", graph.relationships.length);
  printMetric("Code groups detected", featureMap.features.length);

  console.log(`\n${terminal.heading("CODE GROUPS")}`);
  if (visibleGroups.length === 0) {
    console.log(`\n  ${terminal.muted("No code groups found.")}`);
  }

  for (const group of visibleGroups) {
    console.log(`\n  ${terminal.heading(group.name)}`);
    console.log(`    ${terminal.label("Files:")} ${group.files.length}`);
    console.log(`    ${terminal.label("Symbols:")} ${group.symbols.length}`);

    const relatedGroups = group.relationships.map(
      (relationship) =>
        `${formatRelationshipType(relationship.type)} -> ${relationship.to}`,
    );
    console.log(
      `    ${terminal.label("Related groups:")} ${relatedGroups.join(", ") || terminal.muted("none")}`,
    );
  }

  if (visibleGroups.length < featureMap.features.length) {
    console.log(
      `\n  ${terminal.muted(`Showing ${visibleGroups.length} of ${featureMap.features.length} groups; use --max-depth to change this limit.`)}`,
    );
  }

  console.log(`\n${terminal.heading("NEXT STEPS")}`);
  console.log("  Use --graph to inspect graph nodes and relationships.");
  console.log("  Use --json to export the analysis results.");
}

function printMetric(label: string, count: number): void {
  console.log(
    `  ${terminal.label(`${label.padEnd(23)}:`)} ${terminal.success(String(count))}`,
  );
}

function formatRelationshipType(type: string): string {
  const labels: Record<string, string> = {
    IMPORTS: "Imports",
    CONTAINS: "Contains",
    REFERENCES: "References",
    CALLS: "Calls",
    EXPORTS: "Exports",
  };

  return labels[type] ?? type;
}

async function main(): Promise<void> {
  if (values.help || !positionals[0]) {
    printUsage();
    process.exit(values.help ? 0 : 1);
  }

  const repositoryPath = positionals[0];

  if (values.explore) {
    if (
      values.search !== undefined ||
      values.file !== undefined ||
      values.json ||
      values.graph ||
      values.summary ||
      values.format !== undefined ||
      values["max-depth"] !== undefined
    ) {
      throw new Error(
        "--explore cannot be combined with other output options.",
      );
    }

    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      throw new Error("--explore requires an interactive terminal.");
    }

    const repositoryScan = await scanRepositoryTree(repositoryPath);
    const unreadableFiles: string[] = [];
    const graph = await buildCodeGraphFromFiles(
      repositoryPath,
      repositoryScan.files,
      (file, error) => {
        const code =
          error && typeof error === "object" && "code" in error
            ? error.code
            : undefined;
        unreadableFiles.push(
          `${file.relativePath} (${typeof code === "string" ? code : "read error"})`,
        );
      },
    );
    const featureMap = buildFeatureMap(graph);
    await runInteractiveExplorer(
      repositoryScan.files,
      graph,
      featureMap,
      terminal,
      repositoryScan.directories,
      [...repositoryScan.unreadableDirectories, ...unreadableFiles],
    );
    return;
  }

  if (typeof values.search === "string" && typeof values.file === "string") {
    throw new Error("--search and --file cannot be used together");
  }

  if (typeof values.search === "string") {
    const files = await scanRepository(repositoryPath);
    const results = searchRepositoryFiles(files, values.search);

    if (results.length === 0) {
      console.log(terminal.warning("No matching files."));
      return;
    }

    for (const result of results) {
      console.log(`${terminal.success("•")} ${result.relativePath}`);
    }
    return;
  }

  if (typeof values.file === "string") {
    const files = await scanRepository(repositoryPath);
    const details = await readRepositoryFile(files, values.file);

    if (!details) {
      throw new Error("No file found at that repository-relative path.");
    }

    console.log(`${terminal.label("File:")} ${details.relativePath}`);
    console.log(`${terminal.label("Extension:")} ${details.extension}`);
    console.log("");
    console.log(details.content);
    return;
  }

  const maxDepth = Number(values["max-depth"] ?? "10");
  if (!Number.isInteger(maxDepth) || maxDepth < 1) {
    throw new Error("--max-depth must be a positive integer");
  }
  const graph = await buildCodeGraph(repositoryPath);
  const featureMap = buildFeatureMap(graph);

  if (values.json || values.format === "json") {
    console.log(
      JSON.stringify(
        {
          repositoryPath,
          summary: featureMap.summary,
          features: featureMap.features,
          graph: {
            nodes: graph.nodes.length,
            relationships: graph.relationships.length,
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  if (values.graph) {
    console.log(`\n${terminal.heading("CODE NODES")}`);

    for (const node of graph.nodes) {
      console.log(
        `  ${terminal.label(`${node.type}:`)} ${node.name} ${terminal.muted(`[${node.id}]`)}`,
      );
    }

    console.log(`\n${terminal.heading("CODE RELATIONSHIPS")}`);
    for (const relationship of graph.relationships) {
      console.log(
        `  ${terminal.warning(`${formatRelationshipType(relationship.type)}:`)} ${relationship.from} -> ${relationship.to}`,
      );
    }

    console.log(
      `\n${terminal.label("Nodes:")} ${terminal.success(String(graph.nodes.length))}`,
    );
    console.log(
      `${terminal.label("Relationships:")} ${terminal.success(String(graph.relationships.length))}`,
    );
    return;
  }

  printFeatureSummary(
    featureMap,
    graph,
    path.resolve(repositoryPath),
    maxDepth,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `${errorTerminal.error("Failed to map repository:")} ${message}`,
  );
  process.exit(1);
});
