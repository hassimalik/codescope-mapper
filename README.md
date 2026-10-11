# CodeScope Mapper

CodeScope Mapper analyzes JavaScript and TypeScript repositories and presents
their files, symbols, and statically detected relationships in a terminal
summary, graph view, JSON output, or interactive explorer.

It helps developers orient themselves in a codebase. It does not claim to
determine business meaning or infer features from names.

## Run with npx

```bash
npx codescope-mapper -- /path/to/repository
```

The default summary reports source files, symbols, graph relationships, and
directory-derived code groups. Use `--help` for CLI help.

## Summary metrics and code groups

- **Source files analyzed**: file nodes in the graph, one per supported source
  file discovered by the scanner.
- **Symbols discovered**: non-file graph nodes, including supported functions,
  classes, variables, methods, and constructors.
- **Relationships found**: all graph edges, including `CONTAINS` edges and
  relationships to external imports. Duplicate edges are removed by matching
  source, relationship type, and target.
- **Code groups detected**: groups produced by the current path-based grouping
  rule. When `--max-depth` is used, the total still covers all groups and the
  output tells you how many groups are shown.

Groups are based on source file paths, not business concepts or graph
communities. The mapper generally groups files by their immediate directory;
root-level files use their filename stem, while files named `index` use their
parent directory name. Common structural directory names such as `src`, `app`,
`lib`, `pages`, `components`, `packages`, and `features` are skipped when
selecting a directory-derived name for ordinary files. A root-level `index`
file may therefore produce a group named after its parent (for example, `src`).
Same-named directories can be combined. Read these labels as code areas or
modules, not verified product features.

Each group lists the files and symbols assigned to it. Group-to-group
relationships are shown only when both graph endpoints correspond to analyzed
project nodes in different groups. External dependencies and unresolved import
targets are not presented as project groups. `CONTAINS` is a structural edge
and is omitted from the related-group list.

## Relationship types

The graph view and inspector include relationships found by static analysis:

- **Imports**: a source file imports another local file or external module.
- **Contains**: a file contains a symbol, or a class contains a method or
  constructor.
- **Calls**: a detected function or method call from one symbol to another.
- **References**: an imported symbol is referenced by a file.
- **Exports**: a file exports a symbol or re-exports one from another file.

The graph stores direct edges between files and symbols. The file inspector
lists the direct edges touching the selected file node or one of its symbol
nodes. Code-group relationships aggregate edges across group boundaries and
are a separate summary view.

This is static analysis, not a full TypeScript type-check. Receiver-based call
resolution is best-effort and can be ambiguous. Missing edges do not prove
that no runtime relationship exists.

## CLI usage

```bash
# Print the default code-group summary
npx codescope-mapper -- /path/to/repository

# Print all graph nodes and relationships
npx codescope-mapper -- /path/to/repository --graph

# Export summary and graph counts as JSON
npx codescope-mapper -- /path/to/repository --json

# Search repository-relative source paths
npx codescope-mapper -- /path/to/repository --search auth

# Display a file by its repository-relative path
npx codescope-mapper -- /path/to/repository --file src/auth/AuthService.ts

# Launch the interactive file explorer (requires a TTY)
npx codescope-mapper -- /path/to/repository --explore

# Show help or limit how many groups are listed
npx codescope-mapper --help
npx codescope-mapper -- /path/to/repository --max-depth 5
```

Supported options are `--help`/`-h`, `--json`/`-j`, `--graph`, `--summary`,
`--format text|json`, `--max-depth <positive-integer>`, `--search <query>`,
`--file <relative-path>`, `--explore`, `--color auto|always|never`, and
`--no-color`. The default is a text summary; `--json` and `--format json`
produce JSON. `--summary` explicitly selects the default summary. The
interactive explorer cannot be combined with other output options.

The `--max-depth` option name is retained for compatibility; its current
behavior limits the number of code groups listed, not graph traversal depth.
The reported group total still counts all groups.

## Interactive file explorer

Run `codescope-mapper . --explore` in a terminal. Use Up/Down to select an
entry and Enter to open a directory or source file. Backspace moves to the
parent directory; Esc moves back or exits from the repository root; `q` exits.
Type `/` to enter file search. Search results update as you type, match
case-insensitively against supported source-file paths, rank exact filename
matches first, and show full relative paths when filenames repeat. Press Esc
from search to return to the current directory listing.

The browser lists directories discovered by the repository scanner, including
empty directories, and files supported by the scanner. It does not expose
ignored directories such as `node_modules`, `.git`, `dist`, `build`, `.next`,
and `coverage`. Empty directories show an explicit empty state.

Selecting a file opens its inspector. Choose source (paged by terminal height),
the extracted symbol list and a selected symbol's relationships, relationships
involving the file or its symbols, the graph neighborhood, JSON audit data, or
the file's code-group summary. Where an edge has an analyzed endpoint in
another file, the inspector offers a direct action to open that related file.
The relationship view prints the graph's actual `from --type--> to`
direction; it does not convert symbol edges into invented file-to-file edges.

In non-interactive scripts, use `--search <query>` (path search only) or
`--file <relative-path>` rather than `--explore`. Interactive mode requires a
TTY and reports that requirement if standard input/output are redirected.
Unreadable nested directories are skipped with a warning; unreadable files are
reported and excluded from graph analysis, while attempts to inspect a file
that becomes unreadable show an error and return to the browser.

`--color auto` colors output in a TTY unless `NO_COLOR` is set. Use
`--color always` or `FORCE_COLOR=1` to force ANSI colors, and `--no-color`,
`--color never`, or `NO_COLOR` to disable them. JSON output remains plain JSON.

## Interpreting an example

If the output lists a group named `auth` with 5 files and 24 symbols, it means
the current path rule assigned five analyzed files and their discovered symbols
to that code group. It does not mean the analyzer verified that these files
implement authentication as a business capability. A related-group entry such
as `Imports -> users` means the graph contains at least one corresponding
local import edge between analyzed nodes in those groups.

## Supported analysis and limitations

The scanner supports `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.mts`, and
`.cts` files. Symbol extraction covers functions (including identifier-assigned
arrow/function expressions), classes, variables, class methods, and
constructors. Relationship extraction handles supported imports, calls,
references, exports, and re-exports.

The project is not a complete compiler, framework-specific analyzer, or
business-feature classifier. Dynamic behavior, complex dispatch, and some
receiver-based calls may not be resolved. Groups are based on paths and can
combine similarly named directories. Treat results as a navigational aid and
inspect source when correctness matters.

## Contributing and development

Requirements: Node.js 18 or newer.

```bash
git clone https://github.com/hassimalik/codescope-mapper.git
cd codescope-mapper
npm install
npm test
npm run typecheck
npm run build
npm pack --dry-run
```

Contributions should include focused tests for behavior changes and keep
analysis claims traceable to the source graph. Do not publish package changes
as part of local development.

## Maintainer release

Releases are published manually from the `main` branch using the
`Publish to npm` GitHub Actions workflow. Configure npm trusted publishing for
the `hassimalik/codescope-mapper` repository and the
`.github/workflows/publish.yml` workflow file. After updating the package
version on `main`, run the workflow from GitHub Actions. It type-checks, builds,
tests, and publishes through npm's short-lived OIDC authentication; no npm
publish token is stored in GitHub.
