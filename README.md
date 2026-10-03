# CodeScope-mapper

Codescope Mapper is a lightweight JavaScript/TypeScript repository mapper for understanding how a codebase is structured and how features connect to one another.

It scans a repository, extracts files and symbols, builds a graph of imports, calls, references, and exports, and then groups those artifacts into higher-level feature clusters.

## What it does

- Recursively scans a repository for `.js`, `.jsx`, `.ts`, and `.tsx` files
- Ignores common irrelevant folders such as `node_modules`, `.git`, `dist`, `build`, and `coverage`
- Parses source files with the TypeScript compiler API
- Extracts functions, classes, and variables
- Resolves local imports and symbol references
- Builds an in-memory `CodeGraph`
- Aggregates graph data into a `FeatureMap` for quick understanding of feature areas

## Install

```bash
npm install
```

## Usage

```bash
npm run dev -- /path/to/repository
```

Or after building:

```bash
npm run build
node dist/index.js /path/to/repository
```

## CLI options

```bash
codescope-mapper /path/to/repository --summary
codescope-mapper /path/to/repository --graph
codescope-mapper /path/to/repository --json
codescope-mapper /path/to/repository --format text
codescope-mapper /path/to/repository --max-depth 5
codescope-mapper /path/to/repository --color always
codescope-mapper --help
```

## Example output

```text
Feature map summary
Features: 3
Files: 10
Symbols: 25
Feature relationships: 8

- auth
  files: 2
  symbols: 6
  related features: user, session

- user
  files: 3
  symbols: 9
  related features: auth
```

## Example JSON output

```bash
codescope-mapper ./my-app --json
```

This returns a JSON payload with:

- repository path
- summary metrics
- per-feature cluster data
- raw graph counts

## Current MVP scope

This project intentionally targets a practical subset of modern JavaScript and TypeScript repositories:

- functions
- classes
- variables
- named/default/namespace imports
- same-file and cross-file calls
- re-exports and `export *` patterns

It is intentionally not a full compiler or exhaustive code-analysis engine.

## Development

```bash
npm test
npm run build
npm pack --dry-run
```

`--color auto` is the default: it colors interactive terminal output and leaves
redirected output plain. Use `--color always` to force ANSI colors or
`--color never` (or set `NO_COLOR`) to disable them. JSON output is always
plain JSON.

## Packaging

This project is prepared for npm publication as a lightweight CLI tool with package metadata and a `bin` entry.
