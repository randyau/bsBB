# [Project Name] — AI Engineering Guardrails and Codebase Maintenance Rules

> **NOTICE TO AI ASSISTANT:** This document defines the operational constraints for this codebase. These rules override general training data. Read in full before any modification.

---

## The Core Problem This File Solves

LLMs degrade in reliability as codebases grow. This file prevents:

1. **Context gaps** — Modifying files without reading dependencies.
2. **Hallucinated APIs** — Using methods that don't exist in the current version.
3. **Silent regressions** — Fixing one thing, breaking another.
4. **Scope creep** — Refactoring code that wasn't asked for.
5. **Token waste** — Re-streaming large files unnecessarily.
6. **Version confusion** — Mixing APIs from different major versions of a library.
7. **Silent routing errors** — Data assigned to the wrong handler with no error signal.
8. **Phase boundary violations** — Modifying frozen modules with feature changes.

---

## Rule 0: Session Start Protocol — Required Before Every Session

**This rule executes before any other rule. It is not optional.**

At the start of every session, you must:

1. **Environment Audit:** Run `tree -I 'node_modules|target|.git'` (or equivalent) to verify the current file tree.
2. **Context Verification:** For files you intend to modify, grep imports/dependencies to ensure your API model is current.
3. **Explicit Acknowledgement:** State the following before producing any code:
   - **[VERSION]:** One specific old-version pattern you will not use and its current equivalent.
   - **[INVARIANT]:** What happens if the [key invariant] is violated.
   - **[PHASE]:** Current phase and which directories are frozen.
   - **[FILES]:** Which files you will read before modifying any existing code.
4. **Test Gate:** For any change to `[core logic directories]`, name the integration test that must pass before and after. If it does not exist, write it before writing implementation code.

If steps 1–4 are skipped and code is produced directly, reject the output and re-prompt. The acknowledgement is evidence the session started from a correct mental model.

---

## Rule 1: Always Read and Verify Before Writing

Before modifying any file:

1. Read the full file.
2. Read files that import from or are imported by it.
3. Read the corresponding test file.
4. State explicitly what you've read and what the module does.
5. **CLI Validation:** If unsure of an API or type, run a local check (e.g., `tsc --noEmit`, `cargo check`) rather than guessing.

Never modify based on filename alone. Never assume current code matches what was described earlier in the conversation.

---

## Rule 2: Token Efficiency — Grep Before Read, Diff-First Output

Every full file read costs tokens. Exhaust cheaper options first.

**Before reading a file, ask: can grep answer this?**

```bash
# Find where a symbol is defined — don't read the whole file
grep -n "fn process_item\|class ItemProcessor" src/

# Check which files import a module — don't read each one
grep -rl "use crate::pipeline" src/

# Verify an API exists in the current version
grep -n "pub fn interpolate" src/gps/

# Check argument order without reading the full function
grep -A3 "fn slerp_coords"  src/gps/slerp.rs
```

**Read a full file only when:**
- You are about to modify it (required by Rule 1).
- Grep results are ambiguous and context is needed to resolve them.
- The file is <50 lines (full read costs little).

**When you do output code:**
- Output only the specific functions or blocks being changed. Use `// ... existing code ...` to indicate elided sections.
- Propose one logical change at a time. Do not mix refactors with feature additions.

---

## Rule 3: [Critical Library Version] — [Old Version] Forbidden

<!-- Adapt this table to the library most likely to cause version confusion.     -->
<!-- Examples: React 18 vs 19, Tauri v1 vs v2, SQLAlchemy 1.x vs 2.x, etc.      -->

| [Old Version] (FORBIDDEN) | [New Version] (CORRECT) |
|---|---|
| `old.api.pattern` | `new.api.pattern` |
| `old.config.key` | `new.config.key` |

Verify every call against current library reference docs or CLI help before writing.

---

## Rule 4: Expensive Resources Are Pooled — Never Per-Item

<!-- Adapt to your most expensive per-operation resource.                         -->
<!-- Examples: DB connections, subprocess pools, HTTP session objects, etc.       -->

Never spawn [resource] inside a per-item loop or parallel iterator.
Resources are managed from `[path/to/pool/module]`.
See design doc for the full pool architecture.

---

## Rule 5: [Critical Routing / Assignment Invariant]

**This is the most critical correctness rule in the entire codebase.**

<!-- Describe the invariant. The key pattern: data from source A must only be    -->
<!-- processed by handler B, established at config time — never inferred.        -->

[Data item] must only be processed by its explicitly assigned [handler/owner].
Cross-contamination produces wrong output **silently**. No error is raised.

**Rules:**
- Assignment is established at configuration time and confirmed by the user. It must not be inferred or guessed at runtime.
- The routing function must take an explicit assignment parameter — never determine routing from heuristics, timestamps, proximity, or similarity.
- If an item has no assignment: raise a hard error and **halt**. Do not fall back to defaults. Do not pick the first option.

```[language]
// CORRECT — routing is explicit
fn process(item: &Item, handler: &Handler) -> Result<Output, Error>;

// WRONG — routing by heuristic
fn process(item: &Item, all_handlers: &[Handler]) -> Result<Output, Error>;
```

**`[routing_tests]` must pass before any change to `[routing module]` is merged.**
Run these explicitly — confirm the specific test names pass, not just `cargo test` / `npm test`.

---

## Rule 6: Config Files Are Definitions, Not State

The [config/project] file defines inputs. It is not application state.

- The tool does not save processing results into the config file.
- **Idempotency:** Running the same config twice must produce identical output.
- **Portability:** All paths must be relative to the config file's location. Absolute paths must be warned about, never silently accepted.

If you find yourself writing code that modifies a loaded config file during processing, that is a bug. The config file is read-only at runtime.

---

## Rule 7: Persistence — Writes Commit Before State Update

The [database/journal/store] is the crash-safety guarantee.

**Order of operations — never reverse this:**
1. Write and commit to [store].
2. Update in-memory / UI state.

```[language]
// CORRECT order
await store.write(data);
setState(data); // UI update after commit

// WRONG order — crash between these two lines = data lost
setState(data);
await store.write(data);
```

Additional rules:
- Never buffer items in memory before writing to [store].
- Writes must use appropriate transaction semantics.

---

## Rule 8: Logic Isolation — Cross-Cutting Concerns Live in One Place

<!-- Examples: authorization, tier entitlements, feature flags, rate limits.     -->

[Permission/entitlement/feature] logic is computed in `[path/to/module]` only.
No inline permission checks anywhere else in the codebase.

Rules:
- Functions must be pure — no side effects, no network calls inside validation logic.
- Network calls for validation happen before calling this function, not inside it.
- On timeout/failure: [fail open / fail closed] — document which and why.

---

## Rule 9: Document Uncertainty

When uncertain about an API, argument order, payload shape, or behavior:

```
> **UNCERTAINTY:** I am not certain that [thing].
> Verify: [specific CLI command or doc link]. If wrong: [consequence].
```

High-risk areas to flag in this project:
- [Library X] argument order (e.g., (lon, lat) vs (lat, lon))
- [Library Y] major version API differences
- [External service Z] webhook/event payload shapes
- [Async/transactional operation] ordering requirements

---

## Rule 10: Idempotency Is a Tested Invariant

Processing the same inputs twice must produce identical outputs.
`[idempotency_test]` enforces this. Do not break it.

**Multi-step pipeline note:** If step 1 normalises format on first run, compare run 2 vs run 3 (not run 1 vs run 2) to avoid false failures from pre-existing third-party-authored files.

---

## Rule 11: Original Source Files Are Read-Only

The tool writes to [sidecars / output files / derived paths] only.
Source inputs are never modified at runtime.

```[language]
assert_ne!(source_path, output_path, "INVARIANT: output must not overwrite source");
```

`[source_integrity_test]` verifies byte-level source file integrity. Never weaken it.

---

## Rule 12: Module Boundaries

```
┌──────────────────────────────────────────┐
│  Presentation / GUI Layer                │
│  Display only. No business logic.        │
├──────────────────────────────────────────┤
│  Orchestration Layer                     │
│  Sequencing. Progress events. Gate       │
│  checks. Routes to handlers.             │
├──────────────────────────────────────────┤
│  Routing / Assignment Layer              │
│  Matches inputs to handlers. Pure.       │
│  No heuristics. Explicit assignment.     │
├──────────────────────────────────────────┤
│  Processing Modules (pure, zero I/O)     │
│  All business logic lives here.          │
├──────────────────────────────────────────┤
│  I/O Modules (file/network access only,  │
│  no logic)                               │
├──────────────────────────────────────────┤
│  Platform Services (isolated)            │
│  Auth, licensing, external integrations  │
└──────────────────────────────────────────┘
```

- The routing layer must not contain business logic — only routing decisions.
- The orchestration layer must not contain routing logic — only sequencing.
- Processing modules must be pure — no I/O, no side effects.
- I/O modules must be dumb — no decisions, no branching on content.

---

## Rule 13: File and Function Size Limits

| Item | Limit | Action when exceeded |
|---|---|---|
| Any source file | 300 lines | Propose split (see below) |
| Any function / method | 40 lines | Extract helper |
| Any test file | 400 lines | Split by scenario group |
| Nesting depth | 4 levels | Extract named function |
| Function parameters | 5 | Introduce a context/options struct |

Approaching a limit is a signal to extract — not a reason to relax the limit.

**When a file exceeds 300 lines, you must propose a split before continuing.**
State the proposed split explicitly:

```
[filename].rs is 420 lines. Proposed split:
  - [filename]_core.rs   — [what goes here, e.g. pure logic, ~180 lines]
  - [filename]_io.rs     — [what goes here, e.g. file access, ~120 lines]
  - [filename]_tests.rs  — [existing tests extracted, ~120 lines]
Proceed with split? Or continue without splitting?
```

Do not silently continue editing an oversized file. The split proposal is mandatory.
The user may decline — if so, note it and continue — but the offer must be made.

**Why this matters for token efficiency:** files over ~300 lines are expensive to read
in full. Splitting them means future sessions can grep for the relevant module and read
only ~150 lines instead of 400+.

---

## Rule 14: Regression Checklist by Change Type

<!-- Fill in with your actual test file names. -->

**Modifying [routing / assignment logic]:**
- [ ] `[routing_tests]` passes — ALL tests including cross-contamination cases.
- [ ] `[integration_scenario_test]` passes.

**Modifying [config / project file parsing]:**
- [ ] `[config_tests]` passes including relative path resolution.
- [ ] Config opens correctly from a different working directory (path portability).

**Modifying [persistence / journaling]:**
- [ ] `[journal_test]` passes.
- [ ] `[crash_recovery_test]` passes.
- [ ] Crash simulation: integrity check passes after simulated failure.

**Modifying [access control / entitlement logic]:**
- [ ] `[entitlement_tests]` passes at >= 95% coverage.
- [ ] Boundary conditions verified (edge tiers, expired tokens, network timeout).

**All [pipeline / core logic] changes:** run the full test suite before merging.

---

## Rule 15: Phase Freeze Boundaries — Stable Modules Are Immutable After Cutoff

`[path/to/frozen/]` is immutable after [Phase N / date], enforced by pre-commit hook and CI.

**What frozen means:**
- No new functions, structs, types, or exports.
- No existing function signatures may change.
- No existing behaviour may change.
- The only permitted modification is a bug fix, annotated:

```[language]
// BUGFIX: [description] — approved [date]
```

**What is never frozen:** [orchestration / app / integration layer]. Business logic, routing, GUI, and platform services are always mutable.

**If a feature seems to require changing a frozen module:** stop. The feature is being designed wrong. Features are added by writing new orchestration that calls existing frozen functions in new combinations. If genuinely new logic is needed, it goes in a new module — not into an existing frozen one.

---

## Rule 16: TDD Is Mandatory for [Core Logic] Changes

When modifying `[path/to/core/logic/]`, follow this order strictly:

1. Show the existing test that currently passes for the area being changed.
2. Write or update the test that defines the new required behaviour.
3. Confirm the new test **fails** (red) — if it passes already, the test is wrong.
4. Implement the change.
5. Confirm the new test **passes** (green).
6. Run the full test suite.
7. Confirm no previously-passing tests now fail.

**If steps 1–3 are skipped and implementation comes first, the output is rejected.**

This order exists because [core logic area] has the highest silent failure risk. A routing or processing error can produce plausible-looking output that is simply wrong — no runtime error, no signal. The only catch is a test written before the code.

---

## Rule 17: Build System — Quota Protection

- **Local first:** Always use local builds for development (free, unlimited, no quota impact).
- **Metered operations only when necessary:** testing on target platform, release builds.
- **Quota checker:** Run `[scripts/check-quota]` before any cloud/metered operation.
- **Secrets:** Stored at `[path]`. Never committed to the repository.

---

## Hard Invariants — Quick Reference

<!-- Replace placeholders with your project's actual invariants.                  -->

1. **Original files never modified.** All output goes to derived/sidecar paths.
2. **[Critical argument order]** — e.g., (lon, lat) not (lat, lon) for geo APIs.
3. **[Critical algorithm choice]** — e.g., spherical interpolation for longitude, not arithmetic.
4. **[Per-item vs session-level concern]** — e.g., timezone is per-photo, not per-session.
5. **[Pool, not per-item]** — e.g., subprocess pool, not one per file.
6. **Explicit routing.** Assignment is never inferred by heuristic.
7. **Persistence before state.** Store commits before UI/memory state update.
8. **Config is read-only at runtime.** Never written during processing.
9. **Frozen modules.** Features go in the app layer. Bugs get `// BUGFIX:` annotations.
10. **Tests before implementation** for all core logic and routing changes.

---

## How to Adapt This Template

1. Global find-and-replace on bracketed placeholders:
   - `[Project Name]` → your project name
   - `[Critical Library Version]` → the library most likely to cause version confusion
   - `[Critical Routing / Assignment Invariant]` → your most dangerous silent-failure scenario
   - `[Persistence Layer]` → SQLite, Postgres, Redis, a file, etc.
   - `[config / project file]` → whatever your definition file is called
   - `[Core Logic]` / `[path/to/core/]` → wherever your tested business logic lives
   - `[routing_tests]`, `[idempotency_test]`, etc. → your actual test file names

2. Fill in Rule 9 (Document Uncertainty) with the specific argument-order and API traps in your stack.

3. Fill in Rule 14 (Regression Checklist) with your actual test file names.

4. Add project-specific rules between Rule 17 and the Hard Invariants section.

5. Delete this section before committing.
