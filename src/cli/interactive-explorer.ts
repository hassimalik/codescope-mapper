import { emitKeypressEvents } from "node:readline";
import path from "node:path";

import { Terminal } from "./terminal.js";
import type { FileAudit } from "../explorer/file-audit.js";
import { buildFileAudit } from "../explorer/file-audit.js";
import { searchRepositoryFiles } from "../explorer/file-search.js";
import {
  getParentDirectory,
  listDirectoryEntries,
} from "../explorer/file-tree.js";
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
  view:
    | "source"
    | "symbols"
    | "relationships"
    | "json"
    | "graph"
    | "feature"
    | "related"
    | "back";
}

const AUDIT_VIEWS: MenuItem[] = [
  { label: "Source text", view: "source" },
  { label: "Inspect symbols", view: "symbols" },
  { label: "Relationships", view: "relationships" },
  { label: "JSON", view: "json" },
  { label: "Graph neighborhood", view: "graph" },
  { label: "Code group summary", view: "feature" },
];

export async function runInteractiveExplorer(
  files: SourceFile[],
  graph: CodeGraph,
  featureMap: FeatureMap,
  terminal: Terminal,
  directories: string[] = [],
  scanWarnings: string[] = [],
): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Interactive exploration requires an interactive terminal.",
    );
  }

  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  let currentDirectory = "";

  try {
    while (true) {
      const selection = await selectFile(
        files,
        terminal,
        currentDirectory,
        directories,
        scanWarnings,
      );
      currentDirectory = selection.currentDirectory;
      if (!selection.relativePath) {
        return;
      }

      let filePath: string | undefined = selection.relativePath;

      while (filePath) {
        let audit: FileAudit | undefined;
        let auditError: string | undefined;

        try {
          audit = await buildFileAudit(files, graph, featureMap, filePath);
          if (!audit) {
            auditError = `File is no longer available in the scanned repository: ${filePath}`;
          }
        } catch (error) {
          auditError = error instanceof Error ? error.message : String(error);
        }

        if (!audit) {
          writeScreen(
            [
              terminal.error("Could not inspect file"),
              auditError ?? filePath,
              "",
              terminal.muted("Press any key to return to the file browser."),
            ].join("\n"),
          );
          await readKey();
          break;
        }

        const selection = await selectAuditView(audit, terminal);
        if (selection.type === "exit") {
          return;
        }

        if (selection.type === "back") {
          filePath = undefined;
          continue;
        }

        if (selection.type === "related") {
          filePath = selection.relativePath;
          continue;
        }

        if (selection.type === "source") {
          await browseSource(audit, terminal);
          continue;
        }

        if (selection.type === "symbols") {
          await inspectSymbol(audit, graph, terminal);
          continue;
        }

        if (selection.type === "relationships") {
          await browseText(renderRelationships(audit, terminal), terminal);
        } else if (selection.type === "json") {
          await browseText(JSON.stringify(audit, null, 2), terminal);
        } else if (selection.type === "graph") {
          await browseText(renderGraph(audit, terminal), terminal);
        } else if (selection.type === "feature") {
          await browseText(renderFeature(audit, terminal), terminal);
        }
      }
    }
  } finally {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdin.pause();
    writeScreen("");
  }
}

interface FileSelection {
  relativePath?: string;
  currentDirectory: string;
}

async function selectFile(
  files: SourceFile[],
  terminal: Terminal,
  initialDirectory: string,
  directories: string[],
  scanWarnings: string[],
): Promise<FileSelection> {
  let currentDirectory = initialDirectory;
  let searching = false;
  let query = "";
  let selectedIndex = 0;

  while (true) {
    const entries = searching
      ? searchRepositoryFiles(files, query).map((file) => ({
          ...file,
          name: path.posix.basename(file.relativePath),
          type: "file" as const,
        }))
      : listDirectoryEntries(files, currentDirectory, directories);
    selectedIndex = Math.min(selectedIndex, Math.max(0, entries.length - 1));
    const extraRows = (searching ? 2 : 0) + (scanWarnings.length > 0 ? 2 : 0);
    const visibleRows = Math.max(
      1,
      (process.stdout.rows ?? 24) - 8 - extraRows,
    );
    const firstVisible = Math.max(
      0,
      Math.min(
        selectedIndex - visibleRows + 1,
        Math.max(0, entries.length - visibleRows),
      ),
    );
    const visibleEntries = entries.slice(
      firstVisible,
      firstVisible + visibleRows,
    );

    writeScreen(
      [
        terminal.heading("CodeScope Mapper · File Explorer"),
        `${terminal.label("Location:")} ${currentDirectory || "."}`,
        "",
        ...(searching ? [`${terminal.label("Search:")} ${query}`, ""] : []),
        ...(scanWarnings.length > 0
          ? [
              terminal.warning(
                `${scanWarnings.length} item${scanWarnings.length === 1 ? "" : "s"} could not be read and will not appear in analysis: ${scanWarnings.slice(0, 3).join(", ")}`,
              ),
              "",
            ]
          : []),
        ...(visibleEntries.length > 0
          ? visibleEntries.map((entry, index) => {
              const resultIndex = firstVisible + index;
              const selected = resultIndex === selectedIndex;
              const marker = selected ? terminal.success("❯") : " ";
              const label =
                entry.type === "directory"
                  ? `${entry.name}/`
                  : entry.relativePath;
              return `${marker} ${selected ? terminal.format(label, "bold", "cyan") : label}`;
            })
          : [
              searching
                ? "No matching files. Try another name or path."
                : "No supported source files in this directory.",
            ]),
        "",
        terminal.muted(
          searching
            ? "Type to search · ↑/↓ select · Enter open · Esc browse"
            : "↑/↓ move · Enter open · / search · Backspace parent · q quit",
        ),
      ].join("\n"),
    );

    const { input, key } = await readKey();

    if (key.ctrl && key.name === "c") {
      return { currentDirectory };
    }

    if (key.name === "escape") {
      if (searching) {
        searching = false;
        query = "";
        selectedIndex = 0;
      } else if (currentDirectory) {
        currentDirectory = getParentDirectory(currentDirectory);
        selectedIndex = 0;
      } else {
        return { currentDirectory };
      }
    } else if (key.name === "up") {
      selectedIndex = Math.max(0, selectedIndex - 1);
    } else if (key.name === "down") {
      selectedIndex = Math.min(
        Math.max(0, entries.length - 1),
        selectedIndex + 1,
      );
    } else if (key.name === "pageup") {
      selectedIndex = Math.max(0, selectedIndex - visibleRows);
    } else if (key.name === "pagedown") {
      selectedIndex = Math.min(
        Math.max(0, entries.length - 1),
        selectedIndex + visibleRows,
      );
    } else if (key.name === "home") {
      selectedIndex = 0;
    } else if (key.name === "end") {
      selectedIndex = Math.max(0, entries.length - 1);
    } else if (key.name === "backspace") {
      if (searching) {
        query = query.slice(0, -1);
        selectedIndex = 0;
      } else if (currentDirectory) {
        currentDirectory = getParentDirectory(currentDirectory);
        selectedIndex = 0;
      }
    } else if (key.name === "return" && entries[selectedIndex]) {
      const selected = entries[selectedIndex];
      if (searching || selected.type === "file") {
        return {
          currentDirectory,
          relativePath: selected.relativePath,
        };
      }

      currentDirectory = selected.relativePath;
      selectedIndex = 0;
    } else if (!searching && input === "/") {
      searching = true;
      query = "";
      selectedIndex = 0;
    } else if (!searching && input?.toLowerCase() === "q") {
      return { currentDirectory };
    } else if (searching && input && !key.ctrl && input.length === 1) {
      query += input;
      selectedIndex = 0;
    }
  }
}

type InspectorSelection =
  | {
      type:
        | "exit"
        | "back"
        | "source"
        | "symbols"
        | "relationships"
        | "json"
        | "graph"
        | "feature";
    }
  | { type: "related"; relativePath: string };

async function selectAuditView(
  audit: FileAudit,
  terminal: Terminal,
): Promise<InspectorSelection> {
  let selectedIndex = 0;
  const relatedFiles = getRelatedFiles(audit);
  const options: Array<MenuItem & { relativePath?: string }> = [
    ...AUDIT_VIEWS,
    ...relatedFiles.map((relativePath) => ({
      label: `Open related file: ${relativePath}`,
      view: "related" as const,
      relativePath,
    })),
    { label: "Back to file browser", view: "back" as const },
  ];

  while (true) {
    const visibleRows = Math.max(1, (process.stdout.rows ?? 24) - 10);
    const firstVisible = Math.max(
      0,
      Math.min(
        selectedIndex - visibleRows + 1,
        Math.max(0, options.length - visibleRows),
      ),
    );
    writeScreen(
      [
        `${terminal.heading("File inspector:")} ${audit.file.relativePath}`,
        `${terminal.label("Extracted symbols:")} ${audit.symbols.length}`,
        `${terminal.label("Relationships involving this file or its symbols:")} ${audit.relationships.length}`,
        `${terminal.label("Code group:")} ${audit.feature?.name ?? "none"}`,
        "",
        ...options
          .slice(firstVisible, firstVisible + visibleRows)
          .map((option, index) => {
            const optionIndex = firstVisible + index;
            const selected = optionIndex === selectedIndex;
            const marker = selected ? terminal.success("❯") : " ";
            return `${marker} ${selected ? terminal.format(option.label, "bold", "cyan") : option.label}`;
          }),
        "",
        terminal.muted(
          "↑/↓ select · Enter open · Esc back to browser · Ctrl+C quit",
        ),
      ].join("\n"),
    );

    const { key } = await readKey();

    if (key.ctrl && key.name === "c") {
      return { type: "exit" };
    }

    if (key.name === "escape") {
      return { type: "back" };
    }

    if (key.name === "up") {
      selectedIndex = (selectedIndex + options.length - 1) % options.length;
    } else if (key.name === "down") {
      selectedIndex = (selectedIndex + 1) % options.length;
    } else if (key.name === "return") {
      const selected = options[selectedIndex];
      if (selected.view === "back") {
        return { type: "back" };
      }

      if (selected.view === "related") {
        return {
          type: "related",
          relativePath: selected.relativePath ?? "",
        };
      }

      return { type: selected.view };
    }
  }
}

function getRelatedFiles(audit: FileAudit): string[] {
  const endpointIds = new Set(
    audit.relationships.flatMap((relationship) => [
      relationship.from,
      relationship.to,
    ]),
  );
  const relatedFiles = new Set<string>();

  for (const node of audit.graphNodes) {
    if (!endpointIds.has(node.id)) {
      continue;
    }

    const relativePath = node.type === "file" ? node.name : node.location.file;
    if (relativePath !== audit.file.relativePath) {
      relatedFiles.add(relativePath);
    }
  }

  return Array.from(relatedFiles).sort();
}

async function browseSource(
  audit: FileAudit,
  terminal: Terminal,
): Promise<void> {
  const lines = audit.file.content.split(/\r?\n/);
  let firstLine = 0;

  while (true) {
    const pageSize = Math.max(1, (process.stdout.rows ?? 24) - 5);
    const visibleLines = lines.slice(firstLine, firstLine + pageSize);
    writeScreen(
      [
        `${terminal.heading("Source:")} ${audit.file.relativePath}`,
        terminal.muted(
          `Lines ${firstLine + 1}-${Math.min(firstLine + visibleLines.length, lines.length)} of ${lines.length}`,
        ),
        "",
        ...visibleLines,
        "",
        terminal.muted("↑/↓ scroll · Page Up/Down · Esc return to inspector"),
      ].join("\n"),
    );

    const { key } = await readKey();
    if (key.name === "escape" || (key.ctrl && key.name === "c")) {
      return;
    }

    if (key.name === "up") {
      firstLine = Math.max(0, firstLine - 1);
    } else if (key.name === "down") {
      firstLine = Math.min(Math.max(0, lines.length - pageSize), firstLine + 1);
    } else if (key.name === "pageup") {
      firstLine = Math.max(0, firstLine - pageSize);
    } else if (key.name === "pagedown") {
      firstLine = Math.min(
        Math.max(0, lines.length - pageSize),
        firstLine + pageSize,
      );
    } else if (key.name === "home") {
      firstLine = 0;
    } else if (key.name === "end") {
      firstLine = Math.max(0, lines.length - pageSize);
    }
  }
}

async function browseText(content: string, terminal: Terminal): Promise<void> {
  const lines = content.split("\n");
  let firstLine = 0;

  while (true) {
    const pageSize = Math.max(1, (process.stdout.rows ?? 24) - 2);
    const visibleLines = lines.slice(firstLine, firstLine + pageSize);
    writeScreen(
      [
        ...visibleLines,
        "",
        terminal.muted(
          `Lines ${firstLine + 1}-${Math.min(firstLine + visibleLines.length, lines.length)} of ${lines.length} · ↑/↓ scroll · Page Up/Down · Esc return`,
        ),
      ].join("\n"),
    );

    const { key } = await readKey();
    if (key.name === "escape" || (key.ctrl && key.name === "c")) {
      return;
    }

    if (key.name === "up") {
      firstLine = Math.max(0, firstLine - 1);
    } else if (key.name === "down") {
      firstLine = Math.min(Math.max(0, lines.length - pageSize), firstLine + 1);
    } else if (key.name === "pageup") {
      firstLine = Math.max(0, firstLine - pageSize);
    } else if (key.name === "pagedown") {
      firstLine = Math.min(
        Math.max(0, lines.length - pageSize),
        firstLine + pageSize,
      );
    } else if (key.name === "home") {
      firstLine = 0;
    } else if (key.name === "end") {
      firstLine = Math.max(0, lines.length - pageSize);
    }
  }
}

async function inspectSymbol(
  audit: FileAudit,
  graph: CodeGraph,
  terminal: Terminal,
): Promise<void> {
  if (audit.symbols.length === 0) {
    writeScreen(
      [
        `${terminal.heading("Symbols in")} ${audit.file.relativePath}`,
        "",
        "No supported declarations were extracted from this file.",
        "",
        terminal.muted("Esc returns to the inspector."),
      ].join("\n"),
    );
    await readKey();
    return;
  }

  let selectedIndex = 0;
  while (true) {
    const visibleRows = Math.max(1, (process.stdout.rows ?? 24) - 5);
    const firstVisible = Math.max(
      0,
      Math.min(
        selectedIndex - visibleRows + 1,
        Math.max(0, audit.symbols.length - visibleRows),
      ),
    );
    writeScreen(
      [
        `${terminal.heading("Symbols in")} ${audit.file.relativePath}`,
        "",
        ...audit.symbols
          .slice(firstVisible, firstVisible + visibleRows)
          .map((symbol, index) => {
            const selected = firstVisible + index === selectedIndex;
            const marker = selected ? terminal.success("❯") : " ";
            return `${marker} ${symbol.type}: ${symbol.name} ${terminal.muted(`(${symbol.location.startLine}:${symbol.location.startColumn})`)}`;
          }),
        "",
        terminal.muted("↑/↓ select · Enter inspect · Esc return"),
      ].join("\n"),
    );

    const { key } = await readKey();
    if (key.name === "escape" || (key.ctrl && key.name === "c")) {
      return;
    }

    if (key.name === "up") {
      selectedIndex = Math.max(0, selectedIndex - 1);
    } else if (key.name === "down") {
      selectedIndex = Math.min(audit.symbols.length - 1, selectedIndex + 1);
    } else if (key.name === "return") {
      const symbol = audit.symbols[selectedIndex];
      const relationships = graph.relationships.filter(
        (relationship) =>
          relationship.from === symbol.id || relationship.to === symbol.id,
      );
      await browseText(
        [
          `${terminal.heading("Symbol inspector")}`,
          `${terminal.label("Name:")} ${symbol.name}`,
          `${terminal.label("Kind:")} ${symbol.type}`,
          `${terminal.label("ID:")} ${symbol.id}`,
          `${terminal.label("Location:")} ${symbol.location.file}:${symbol.location.startLine}:${symbol.location.startColumn}`,
          "",
          terminal.label(
            `Relationships involving this symbol (${relationships.length}):`,
          ),
          ...(relationships.length > 0
            ? relationships.map(formatRelationship)
            : ["none"]),
          "",
          terminal.muted("Esc returns to the symbol list."),
        ].join("\n"),
        terminal,
      );
    }
  }
}

function renderRelationships(audit: FileAudit, terminal: Terminal): string {
  return [
    `${terminal.heading("Relationships linked to")} ${audit.file.relativePath}`,
    "",
    ...(audit.relationships.length > 0
      ? audit.relationships.map(formatRelationship)
      : ["No relationships found."]),
    "",
    terminal.muted("Esc returns to the inspector."),
  ].join("\n");
}

function renderGraph(audit: FileAudit, terminal: Terminal): string {
  return [
    `${terminal.heading("Graph neighborhood:")} ${audit.file.relativePath}`,
    "",
    terminal.label("Nodes:"),
    ...(audit.graphNodes.length > 0
      ? audit.graphNodes.map(
          (node) =>
            `${terminal.label(`${node.type}:`)} ${node.name} ${terminal.muted(`[${node.id}]`)}`,
        )
      : ["(none)"]),
    "",
    terminal.label("Edges:"),
    ...(audit.relationships.length > 0
      ? audit.relationships.map(formatRelationship)
      : ["(none)"]),
    "",
    terminal.muted("Esc returns to the inspector."),
  ].join("\n");
}

function renderFeature(audit: FileAudit, terminal: Terminal): string {
  const feature = audit.feature;
  if (!feature) {
    return [
      `${terminal.heading("Code group summary:")} ${audit.file.relativePath}`,
      "",
      "No code group was found for this file.",
      "",
      terminal.muted("Esc returns to the inspector."),
    ].join("\n");
  }

  return [
    `${terminal.heading("Code group summary:")} ${feature.name}`,
    "",
    terminal.label(`Files (${feature.files.length}):`),
    ...feature.files.map((file) => `  ${file}`),
    "",
    terminal.label(`Symbols (${feature.symbols.length}):`),
    ...feature.symbols.map((symbol) => `  ${symbol}`),
    "",
    terminal.label(
      `Relationships to other code groups (${feature.relationships.length}):`,
    ),
    ...(feature.relationships.length > 0
      ? feature.relationships.map(formatRelationship)
      : ["  none"]),
    "",
    terminal.muted("Esc returns to the inspector."),
  ].join("\n");
}

function formatRelationship(relationship: CodeRelationship): string {
  const labels: Record<CodeRelationship["type"], string> = {
    IMPORTS: "Imports",
    CONTAINS: "Contains",
    REFERENCES: "References",
    CALLS: "Calls",
    EXPORTS: "Exports",
  };

  return `${relationship.from} --${labels[relationship.type]}--> ${relationship.to}`;
}

function writeScreen(content: string): void {
  const maxRows = Math.max(1, (process.stdout.rows ?? 24) - 1);
  const lines = content.split("\n");
  const visibleContent =
    lines.length > maxRows
      ? [
          ...lines.slice(0, maxRows - 1),
          "… resize the terminal or use the arrow keys to navigate",
        ].join("\n")
      : content;

  process.stdout.write(`\u001B[2J\u001B[H${visibleContent}`);
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
