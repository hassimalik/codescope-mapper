import { emitKeypressEvents } from "node:readline";

import type { FileAudit } from "../explorer/file-audit.js";
import { buildFileAudit } from "../explorer/file-audit.js";
import { searchRepositoryFiles } from "../explorer/file-search.js";
import type { FeatureMap } from "../feature-mapper.js";
import type { CodeGraph } from "../graph/code-graph.js";
import type { CodeRelationship } from "../types/relationships.js";
import type { SourceFile } from "../types/source-file.js";

interface TerminalKey {
  name?: string;
  ctrl?: boolean;
}

interface MenuItem {
  label: string;
  view: "source" | "symbols" | "relationships" | "json" | "graph" | "feature";
}

const AUDIT_VIEWS: MenuItem[] = [
  { label: "Source text", view: "source" },
  { label: "Symbols", view: "symbols" },
  { label: "Relationships", view: "relationships" },
  { label: "JSON", view: "json" },
  { label: "Graph neighborhood", view: "graph" },
  { label: "Feature summary", view: "feature" },
];

export async function runInteractiveExplorer(
  files: SourceFile[],
  graph: CodeGraph,
  featureMap: FeatureMap,
): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Interactive exploration requires an interactive terminal.",
    );
  }

  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  try {
    while (true) {
      const selectedFile = await selectFile(files);
      if (!selectedFile) {
        return;
      }

      const audit = await buildFileAudit(
        files,
        graph,
        featureMap,
        selectedFile.relativePath,
      );
      if (!audit) {
        throw new Error(
          `Selected repository file is no longer available: ${selectedFile.relativePath}`,
        );
      }

      while (true) {
        const selectedView = await selectAuditView(audit.file.relativePath);
        if (selectedView === "exit") {
          return;
        }

        if (!selectedView) {
          break;
        }

        writeScreen(renderAudit(audit, selectedView));
        await readKey();
      }
    }
  } finally {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    writeScreen("");
  }
}

async function selectFile(
  files: SourceFile[],
): Promise<{ relativePath: string } | undefined> {
  let query = "";
  let selectedIndex = 0;

  while (true) {
    const results = searchRepositoryFiles(files, query);
    selectedIndex = Math.min(selectedIndex, Math.max(0, results.length - 1));
    const visibleRows = Math.max(3, (process.stdout.rows ?? 24) - 7);
    const firstVisible = Math.max(
      0,
      Math.min(
        selectedIndex - visibleRows + 1,
        Math.max(0, results.length - visibleRows),
      ),
    );
    const visibleResults = results.slice(
      firstVisible,
      firstVisible + visibleRows,
    );

    writeScreen(
      [
        "Repository files",
        `Filter: ${query}`,
        "",
        ...(visibleResults.length > 0
          ? visibleResults.map((file, index) => {
              const resultIndex = firstVisible + index;
              const marker = resultIndex === selectedIndex ? ">" : " ";
              return `${marker} ${file.relativePath}  ${file.extension}`;
            })
          : ["No matching files."]),
        "",
        "Type to filter | Up/Down select | Enter audit | Esc quit",
      ].join("\n"),
    );

    const { input, key } = await readKey();

    if (key.ctrl && key.name === "c") {
      return undefined;
    }

    if (key.name === "escape") {
      return undefined;
    }

    if (key.name === "up") {
      selectedIndex = Math.max(0, selectedIndex - 1);
    } else if (key.name === "down") {
      selectedIndex = Math.min(
        Math.max(0, results.length - 1),
        selectedIndex + 1,
      );
    } else if (key.name === "pageup") {
      selectedIndex = Math.max(0, selectedIndex - visibleRows);
    } else if (key.name === "pagedown") {
      selectedIndex = Math.min(
        Math.max(0, results.length - 1),
        selectedIndex + visibleRows,
      );
    } else if (key.name === "home") {
      selectedIndex = 0;
    } else if (key.name === "end") {
      selectedIndex = Math.max(0, results.length - 1);
    } else if (key.name === "backspace") {
      query = query.slice(0, -1);
      selectedIndex = 0;
    } else if (key.name === "return" && results[selectedIndex]) {
      return { relativePath: results[selectedIndex].relativePath };
    } else if (input && !key.ctrl && input.length === 1) {
      query += input;
      selectedIndex = 0;
    }
  }
}

async function selectAuditView(
  relativePath: string,
): Promise<MenuItem["view"] | "exit" | undefined> {
  let selectedIndex = 0;
  const options = [
    ...AUDIT_VIEWS,
    { label: "Back to files", view: "back" as const },
  ];

  while (true) {
    writeScreen(
      [
        `File audit: ${relativePath}`,
        "",
        ...options.map((option, index) => {
          const marker = index === selectedIndex ? ">" : " ";
          return `${marker} ${option.label}`;
        }),
        "",
        "Up/Down select | Enter open | Esc back to files",
      ].join("\n"),
    );

    const { key } = await readKey();

    if (key.ctrl && key.name === "c") {
      return "exit";
    }

    if (key.name === "escape") {
      return undefined;
    }

    if (key.name === "up") {
      selectedIndex = (selectedIndex + options.length - 1) % options.length;
    } else if (key.name === "down") {
      selectedIndex = (selectedIndex + 1) % options.length;
    } else if (key.name === "return") {
      const selected = options[selectedIndex];
      return selected.view === "back" ? undefined : selected.view;
    }
  }
}

function renderAudit(audit: FileAudit, view: MenuItem["view"]): string {
  switch (view) {
    case "source":
      return [
        `File: ${audit.file.relativePath}`,
        `Extension: ${audit.file.extension}`,
        "",
        audit.file.content,
        "",
        "Press any key to return to the audit menu.",
      ].join("\n");
    case "symbols":
      return [
        `Symbols in ${audit.file.relativePath}`,
        "",
        ...(audit.symbols.length > 0
          ? audit.symbols.map(
              (symbol) =>
                `${symbol.type}: ${symbol.name} (${symbol.location.startLine}:${symbol.location.startColumn})`,
            )
          : ["No symbols found."]),
        "",
        "Press any key to return to the audit menu.",
      ].join("\n");
    case "relationships":
      return renderRelationships(audit);
    case "json":
      return `${JSON.stringify(audit, null, 2)}\n\nPress any key to return to the audit menu.`;
    case "graph":
      return renderGraph(audit);
    case "feature":
      return renderFeature(audit);
  }
}

function renderRelationships(audit: FileAudit): string {
  return [
    `Relationships linked to ${audit.file.relativePath}`,
    "",
    ...(audit.relationships.length > 0
      ? audit.relationships.map(formatRelationship)
      : ["No relationships found."]),
    "",
    "Press any key to return to the audit menu.",
  ].join("\n");
}

function renderGraph(audit: FileAudit): string {
  const nodeNames = new Map(
    audit.graphNodes.map((node) => [node.id, node.name]),
  );
  const relationships = audit.relationships.map(
    (relationship) =>
      `${nodeNames.get(relationship.from) ?? relationship.from} --${relationship.type}--> ${nodeNames.get(relationship.to) ?? relationship.to}`,
  );

  return [
    `Graph neighborhood: ${audit.file.relativePath}`,
    "",
    "Nodes:",
    ...(audit.graphNodes.length > 0
      ? audit.graphNodes.map(
          (node) => `${node.type}: ${node.name} [${node.id}]`,
        )
      : ["(none)"]),
    "",
    "Edges:",
    ...(relationships.length > 0 ? relationships : ["(none)"]),
    "",
    "Press any key to return to the audit menu.",
  ].join("\n");
}

function renderFeature(audit: FileAudit): string {
  const feature = audit.feature;
  if (!feature) {
    return [
      `Feature summary: ${audit.file.relativePath}`,
      "",
      "No feature grouping found for this file.",
      "",
      "Press any key to return to the audit menu.",
    ].join("\n");
  }

  return [
    `Feature summary: ${feature.name}`,
    "",
    `Files (${feature.files.length}):`,
    ...feature.files.map((file) => `  ${file}`),
    "",
    `Symbols (${feature.symbols.length}):`,
    ...feature.symbols.map((symbol) => `  ${symbol}`),
    "",
    `Feature relationships (${feature.relationships.length}):`,
    ...(feature.relationships.length > 0
      ? feature.relationships.map(formatRelationship)
      : ["  none"]),
    "",
    "Press any key to return to the audit menu.",
  ].join("\n");
}

function formatRelationship(relationship: CodeRelationship): string {
  return `${relationship.from} --${relationship.type}--> ${relationship.to}`;
}

function writeScreen(content: string): void {
  process.stdout.write(`\u001B[2J\u001B[H${content}`);
}

function readKey(): Promise<{ input: string; key: TerminalKey }> {
  return new Promise((resolve) => {
    const onKeypress = (input: string, key: TerminalKey) => {
      process.stdin.off("keypress", onKeypress);
      resolve({ input, key });
    };
    process.stdin.on("keypress", onKeypress);
  });
}
