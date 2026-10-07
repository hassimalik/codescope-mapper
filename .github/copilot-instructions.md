# CodeFlow Mapper - Copilot Engineering Instructions

## Project Identity

Project name:

CodeFlow Mapper

Repository:

codeflow-mapper

CodeFlow Mapper is an open-source developer tool that analyzes JavaScript and TypeScript repositories and discovers how features travel through a codebase.

The long-term product goal is:

Repository
  ↓
Static Analysis
  ↓
CodeGraph
  ↓
Feature Mapping
  ↓
FeatureMap
  ↓
Visualization / CLI / API

Example user question:

"How does authentication work?"

Potential result:

LoginForm
  ↓
useAuth()
  ↓
AuthService.login()
  ↓
API route
  ↓
Controller
  ↓
Service
  ↓
Repository / Database

The system must prioritize:

1. Accuracy
2. Source-code traceability
3. Deterministic static analysis
4. Maintainability
5. Clear architecture
6. Scalability
7. Developer experience
8. Performance
9. Extensibility
10. Visual polish

Do not optimize for flashy output at the expense of correctness.

---

# Core Engineering Philosophy

CodeFlow Mapper must be built as a serious open-source project.

Favor:

- small focused modules
- clear responsibilities
- explicit data structures
- deterministic behavior
- strong typing
- testable components
- stable public interfaces
- incremental development
- predictable error handling
- repository-relative paths
- source locations
- separation of concerns

Avoid:

- giant files
- giant functions
- duplicated logic
- hidden global state
- unnecessary abstractions
- premature frameworks
- unnecessary dependencies
- premature microservices
- unnecessary databases
- unnecessary AI
- regex-based source-code parsing when the TypeScript AST can be used
- speculative features
- breaking existing behavior without a reason

Do not introduce infrastructure merely because it might be useful later.

Build only what the current product stage requires.

---

# Architectural Principle

The core analysis engine must remain independent from:

- React
- Next.js
- browser UI
- CLI presentation
- HTTP APIs
- databases
- hosted infrastructure
- authentication systems
- AI providers

The core should be reusable by multiple future consumers.

Target architecture:

Repository
  ↓
Scanner
  ↓
Reader
  ↓
Parser
  ↓
Symbol Extractor
  ↓
Relationship Extractor
  ↓
CodeGraph
  ↓
Feature Mapper
  ↓
FeatureMap
  ↓
CLI / Web / API

Do not reverse this dependency direction.

---

# Current Architecture

Current source structure:

src/
├── index.ts
├── scanner.ts
├── reader.ts
├── parser.ts
├── symbol.ts
├── symbol-extractor.ts
├── relationship-extractor.ts
├── types/
│   └── relationship.ts
└── graph/
    ├── code-graph.ts
    └── graph-builder.ts

The responsibilities are:

## scanner.ts

Discovers supported source files inside a repository.

It must:

- recursively scan source directories
- support JS/JSX/TS/TSX
- ignore dependency/build/generated directories
- return repository-relative paths for product data
- retain absolute paths only where required for filesystem operations

Do not expose machine-specific parent directories as user-facing graph data.

---

## reader.ts

Reads source file contents.

It should not perform AST analysis or graph construction.

---

## parser.ts

Converts source text into a TypeScript AST using the TypeScript Compiler API.

Do not replace AST parsing with regex-based parsing.

---

## symbol.ts

Defines the canonical symbol data model.

Current concepts include:

- file
- function
- class
- variable
- import
- export

Symbols must contain source-location information.

A symbol should be traceable back to:

- repository-relative file
- start line
- start column
- end line
- end column

---

## symbol-extractor.ts

Responsible only for discovering symbols from ASTs.

It should not:

- build the entire graph
- resolve unrelated imports
- perform feature search
- perform visualization
- print CLI output

When adding support for a new symbol type, keep the extractor maintainable and testable.

Modern JavaScript/TypeScript syntax must be considered.

For example:

const getUser = () => {};

should eventually be recognized as a function rather than merely a variable.

---

## relationship-extractor.ts

Responsible for discovering relationships between symbols/files.

Current relationship types:

- IMPORTS
- CONTAINS
- REFERENCES
- CALLS

Relationships must be deterministic.

Do not invent relationships.

If a relationship cannot be proven from the available static information, prefer:

- omitting it
- marking it unresolved
- or explicitly representing uncertainty

Do not silently create false graph edges.

Accuracy is more important than graph density.

---

## graph/code-graph.ts

Defines the graph representation.

Current conceptual model:

CodeGraph
  ├── nodes
  └── relationships

The CodeGraph is an intermediate representation.

It should remain independent from UI concerns.

---

## graph/graph-builder.ts

Orchestrates analysis.

Prefer this general process:

1. Resolve repository path
2. Scan repository
3. Read source files
4. Parse all source files
5. Extract symbols from all files
6. Extract relationships using the complete symbol set
7. Construct CodeGraph
8. Return CodeGraph

Maintain the two-phase approach:

Phase 1:
discover all files and symbols.

Phase 2:
resolve relationships.

Do not introduce scan-order-dependent behavior.

---

# Source Path Rules

Filesystem paths and product paths are different concepts.

Internal filesystem operations may use:

/media/storage_drive/...
/home/user/...

But graph/UI/source references must use repository-relative paths:

app/page.tsx
app/components/Greeting.tsx

Never expose machine-specific parent directories in CodeFlow Mapper's user-facing graph.

Principle:

"Filesystem details are implementation details. Repository-relative paths are product data."

---

# Relationship Accuracy

Never assume that a same-named symbol is necessarily the correct target.

Example:

AuthService.login()
PaymentService.login()
UserService.login()

A global name-only lookup is ambiguous.

Prefer progressively stronger resolution:

1. Same-file symbol
2. Explicit import binding
3. Receiver-aware resolution
4. Known module relationship
5. Type information when available
6. Otherwise leave unresolved

Never claim certainty where the static analysis does not provide certainty.

---

# Current Development Stage

The project is currently in the early analysis-engine stage.

Approximate roadmap:

Phase 1:
Repository scanning

Phase 2:
Symbol extraction

Phase 3:
Relationship extraction

Phase 4:
CodeGraph quality

Phase 5:
Feature Mapping

Phase 6:
FeatureMap

Phase 7:
Visualization

Phase 8:
CLI / Developer Experience

Phase 9:
Testing / Open Source Readiness

Phase 10:
Hosted Web Product

Do not skip directly to hosted infrastructure.

The analysis engine must become reliable before advanced product layers are added.

---

# Feature Roadmap

Prioritize work in this order.

## Foundation

- repository scanning
- AST parsing
- symbol extraction
- import resolution
- references
- function calls
- CodeGraph
- tests

## Code Intelligence

- arrow functions
- async functions
- class methods
- constructors
- default imports
- named imports
- namespace imports
- exports
- re-exports
- barrel files
- dynamic imports where statically resolvable
- better method resolution
- better symbol identity
- source locations
- unresolved relationship representation

## Feature Mapping

Eventually:

Feature Query
  ↓
Candidate Discovery
  ↓
Candidate Ranking
  ↓
Graph Traversal
  ↓
Relevant Path Extraction
  ↓
FeatureMap

Feature mapping must initially favor deterministic/static-analysis signals.

Do not introduce an LLM simply because the product involves natural-language questions.

AI may later assist with:

- query interpretation
- semantic ranking
- summarization
- explanation

But AI must not become the source of truth for code relationships.

---

# Testing Philosophy

Every meaningful analysis capability should have automated tests.

At minimum test:

- happy path
- cross-file behavior
- aliases
- ambiguous cases
- unsupported cases
- duplicate prevention
- source locations
- edge cases

Prefer tests that validate behavior rather than implementation details.

A refactor should not require rewriting tests if behavior remains the same.

Tests should protect the CodeGraph contract.

---

# Development Workflow

For every feature:

1. Understand the existing architecture.
2. Inspect the relevant files.
3. Identify the smallest architectural change.
4. Implement one coherent capability.
5. Run TypeScript type checking.
6. Run tests.
7. Run the build.
8. Run the analyzer against the test repository.
9. Inspect graph output.
10. Update documentation.
11. Update README when the user-visible capability changes.
12. Keep the change focused.
13. Do not modify unrelated files.
14. Do not create unnecessary dependencies.

Preferred validation:

npm run test
npm run build
npm run dev <repository>

If a command is unavailable, determine the correct existing project command before changing package.json.

---

# Important Rule: Small Changes

Do NOT implement the entire roadmap in one change.

One meaningful capability at a time.

For example:

GOOD:

"Add arrow-function symbol detection."

Then:

- modify symbol extraction
- add tests
- run tests
- build
- update README if relevant

BAD:

"Implement arrow functions, classes, decorators, TypeScript types, feature mapping, visualization and AI."

Keep the architectural surface small.

---

# Dependency Philosophy

Do not add a dependency unless there is a clear reason.

Before adding a dependency:

1. Check whether the functionality can be implemented using Node.js.
2. Check whether TypeScript already provides the capability.
3. Check whether an existing project dependency can provide it.
4. Consider maintenance cost.
5. Consider bundle/runtime impact.
6. Consider whether the dependency is justified for an open-source library.

Prefer standard platform capabilities.

---

# Error Handling

Errors should be:

- explicit
- understandable
- actionable

Do not silently swallow analysis failures.

For repository analysis:

- distinguish invalid repository paths
- distinguish unreadable files
- distinguish unsupported syntax
- distinguish unresolved imports
- distinguish unresolved symbols

The analyzer should prefer partial useful results over catastrophic failure when safe.

However, never hide corrupted or invalid graph data.

---

# Performance

The tool should eventually support large repositories.

Avoid:

- repeatedly scanning the same directory
- repeatedly parsing the same file
- O(n²) searches where avoidable
- unnecessary AST traversals
- repeatedly resolving the same imports
- loading unnecessary files

Prefer indexed lookup structures when repository size makes linear searches expensive.

Do not prematurely optimize tiny code.

Optimize when the architecture or measured behavior justifies it.

---

# Public API Stability

Treat exported types and functions as contracts.

Before changing a public type:

- check usages
- understand compatibility implications
- preserve backwards compatibility when reasonable
- update tests
- update documentation

Do not casually rename public concepts.

---

# README Requirements

README.md is a first-class product surface.

Maintain it like a mature open-source repository.

It should progressively contain:

1. Project title
2. Short product description
3. Badges
4. Why CodeFlow Mapper exists
5. Example / demo
6. Key capabilities
7. Architecture overview
8. Installation
9. Usage
10. Example output
11. Supported languages/frameworks
12. Current limitations
13. Roadmap
14. Development setup
15. Testing
16. Contributing
17. Project status
18. License

The README must reflect the actual implementation.

Never advertise functionality that does not exist.

Never claim 100% accuracy.

Use honest wording such as:

- "currently supported"
- "experimental"
- "planned"
- "best effort"
- "static analysis limitation"

When a significant feature is added, update the README in the same change.

---

# README Style

The README should feel like a serious popular open-source project.

Aim for:

- clear hierarchy
- concise explanations
- strong examples
- architecture diagrams
- code examples
- feature tables
- realistic claims
- professional tone
- easy onboarding

Avoid:

- excessive marketing
- fake metrics
- fake user counts
- fake benchmarks
- claims of perfect accuracy
- unnecessary walls of text

The README should answer quickly:

"What is this?"

"Why should I care?"

"How do I install it?"

"How do I use it?"

"How does it work?"

"What does it support?"

"What are its limitations?"

"How can I contribute?"

---

# Releases

When a substantial user-visible capability is completed, keep release documentation ready.

Use semantic versioning:

MAJOR.MINOR.PATCH

General meaning:

PATCH:
bug fixes

MINOR:
backwards-compatible features

MAJOR:
breaking changes

Maintain a CHANGELOG.md once the project reaches a release-oriented stage.

Do not create releases for every tiny internal refactor.

---

# Git Hygiene

Use focused commits.

Preferred style:

feat: add arrow function detection

fix: resolve aliased imports correctly

test: add relationship extraction coverage

refactor: separate symbol indexing from traversal

docs: improve README architecture section

ci: add build validation

Avoid giant commits containing unrelated changes.

---

# GitHub CI

CI should protect the main branch.

At minimum verify:

- dependencies install
- TypeScript type checking
- build
- tests
- formatting

Do not add complicated CI infrastructure without a reason.

---

# Code Quality

Prefer:

- descriptive names
- small functions
- explicit types
- narrow interfaces
- predictable control flow
- minimal side effects

Avoid:

- clever one-liners that reduce readability
- deeply nested conditionals
- magic strings scattered throughout the code
- duplicated path-resolution logic
- duplicated relationship-resolution logic

If a concept appears in multiple places, consider whether it deserves a shared abstraction.

Do not abstract prematurely.

---

# Documentation

Documentation must evolve with the implementation.

When adding a new architectural concept, consider updating:

- README
- architecture documentation
- roadmap
- tests
- examples

Do not create documentation files simply to increase the file count.

---

# AI Policy

AI is not the foundation of CodeFlow Mapper.

Static analysis is the source of truth.

If AI is eventually introduced:

AI may:

- interpret natural-language feature queries
- rank candidate symbols
- summarize discovered flows
- explain relationships

AI must not:

- invent code relationships
- silently fabricate symbols
- override proven AST relationships
- hide uncertainty
- become required for basic repository analysis

The product should remain useful without AI.

---

# Future Extensibility

Design the core so future analysis providers can exist.

Potential future architecture:

Analyzer
├── TypeScriptAnalyzer
├── JavaScriptAnalyzer
└── FutureLanguageAnalyzer

Relationship resolution should eventually be extensible.

Feature mapping should consume a graph abstraction rather than AST implementation details.

Visualization should consume FeatureMap rather than directly inspecting ASTs.

---

# Definition of Done

A feature is not complete merely because the code compiles.

A meaningful feature is complete when:

- implementation exists
- architecture remains clean
- types pass
- tests pass
- build passes
- behavior has been manually verified where appropriate
- documentation is updated
- README is updated when user-facing
- no unrelated code was changed
- limitations are documented
- existing functionality still works

---

# Copilot Behavior

Before modifying code:

1. Inspect relevant files.
2. Understand current behavior.
3. Reuse existing abstractions.
4. Identify potential regressions.
5. Choose the smallest maintainable implementation.

When modifying a file:

- preserve existing functionality
- return the complete updated file when presenting the change
- do not provide partial snippets when a full file is required
- avoid unrelated formatting changes

When uncertain:

- do not invent architecture
- inspect the repository
- infer from existing patterns
- ask only when the ambiguity materially affects the design

Do not repeatedly ask for confirmation for obvious implementation details.

---

# Token Efficiency

Be efficient.

Do not repeatedly restate the entire project architecture.

Do not regenerate unchanged files.

Do not explore unrelated files.

Do not perform unnecessary searches.

Prefer:

1. inspect
2. reason
3. modify
4. test
5. report

For explanations, provide the important reasoning but avoid unnecessary repetition.

---

# Most Important Rule

CodeFlow Mapper is intended to become a serious, maintainable, open-source developer tool.

Every implementation decision should answer:

"Will this still make sense when the repository is significantly larger and the project has many contributors?"

If yes, proceed.

If no, redesign before implementing.

Accuracy beats cleverness.

Maintainability beats speed.

Small verified steps beat giant speculative implementations.

Build the analysis engine first.

Then build the feature mapper.

Then build the experience around it.