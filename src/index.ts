#!/usr/bin/env node

import { parseArgs } from "node:util";

import { readRepositoryFile } from "./explorer/file-details.js";
import { searchRepositoryFiles } from "./explorer/file-search.js";
import { runInteractiveExplorer } from "./cli/interactive-explorer.js";
import { buildFeatureMap } from "./feature-mapper.js";
import {
  buildCodeGraph,
  buildCodeGraphFromFiles,
} from "./graph/graph-builder.js";
import { scanRepository } from "./scanner.js";

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
  },
});

type ColorMode = "auto" | "always" | "never";

const colorMode = values.color as ColorMode;
const useColor =
  colorMode === "always" ||
  (colorMode === "auto" &&
    Boolean(process.stdout.isTTY) &&
    !process.env.NO_COLOR);

const ansi = {
  reset: "\u001B[0m",
  bold: "\u001B[1m",
  cyan: "\u001B[36m",
  green: "\u001B[32m",
  yellow: "\u001B[33m",
  red: "\u001B[31m",
} as const;

function color(text: string, ...styles: readonly string[]): string {
  return useColor ? `${styles.join("")}${text}${ansi.reset}` : text;
}

function printUsage(): void {
  console.log(`codescope Mapper

Usage:
  codescope-mapper <repository-path> [options]

Options:
  --explore                Open the interactive repository explorer
  --search <query>         Search repository-relative file paths
  --file <relative-path>   Display a repository file and its source text
  --graph                  Print the raw graph summary
  --summary                Print a feature-summary view (default)
  --json                   Output JSON instead of human-readable text
  --format <text|json>     Select output format
  --max-depth <number>     Limit feature traversal depth in summary output
  --color <mode>           Use color: auto (default), always, or never
  -h, --help               Show this help text
`);
}

function printFeatureSummary(
  featureMap: ReturnType<typeof buildFeatureMap>,
  maxDepth: number,
): void {
  console.log(`\n${color("Feature map summary", ansi.bold, ansi.cyan)}`);
  console.log(
    `${color("Features:", ansi.bold)} ${color(String(featureMap.summary.totalFeatures), ansi.green)}`,
  );
  console.log(
    `${color("Files:", ansi.bold)} ${color(String(featureMap.summary.totalFiles), ansi.green)}`,
  );
  console.log(
    `${color("Symbols:", ansi.bold)} ${color(String(featureMap.summary.totalSymbols), ansi.green)}`,
  );
  console.log(
    `${color("Feature relationships:", ansi.bold)} ${color(String(featureMap.summary.totalFeatureRelationships), ansi.green)}`,
  );

  const visibleFeatures = featureMap.features.slice(0, Math.max(1, maxDepth));

  for (const feature of visibleFeatures) {
    console.log(
      `\n${color("•", ansi.yellow)} ${color(feature.name, ansi.bold, ansi.cyan)}`,
    );
    console.log(`  ${color("files:", ansi.bold)} ${feature.files.length}`);
    console.log(`  ${color("symbols:", ansi.bold)} ${feature.symbols.length}`);
    console.log(
      `  ${color("related features:", ansi.bold)} ${feature.relationships.map((relationship) => relationship.to).join(", ") || color("none", ansi.yellow)}`,
    );
  }
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

    const files = await scanRepository(repositoryPath);
    const graph = await buildCodeGraphFromFiles(repositoryPath, files);
    const featureMap = buildFeatureMap(graph);
    await runInteractiveExplorer(files, graph, featureMap);
    return;
  }

  if (typeof values.search === "string" && typeof values.file === "string") {
    throw new Error("--search and --file cannot be used together");
  }

  if (typeof values.search === "string") {
    const files = await scanRepository(repositoryPath);
    const results = searchRepositoryFiles(files, values.search);

    if (results.length === 0) {
      console.log("No matching files.");
      return;
    }

    for (const result of results) {
      console.log(result.relativePath);
    }
    return;
  }

  if (typeof values.file === "string") {
    const files = await scanRepository(repositoryPath);
    const details = await readRepositoryFile(files, values.file);

    if (!details) {
      throw new Error("No file found at that repository-relative path.");
    }

    console.log(`File: ${details.relativePath}`);
    console.log(`Extension: ${details.extension}`);
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
    console.log(`\n${color("CodeGraph", ansi.bold, ansi.cyan)}`);

    for (const node of graph.nodes) {
      console.log(`  ${color(`${node.type}:`, ansi.bold)} ${node.name}`);
    }

    for (const relationship of graph.relationships) {
      console.log(
        `  ${color(`${relationship.type}:`, ansi.yellow)} ${relationship.from} → ${relationship.to}`,
      );
    }

    console.log(
      `\n${color("Nodes:", ansi.bold)} ${color(String(graph.nodes.length), ansi.green)}`,
    );
    console.log(
      `${color("Relationships:", ansi.bold)} ${color(String(graph.relationships.length), ansi.green)}`,
    );
    return;
  }

  printFeatureSummary(featureMap, maxDepth);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    `${color("Failed to map repository:", ansi.bold, ansi.red)} ${message}`,
  );
  process.exit(1);
});
