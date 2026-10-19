# PR 50 re-evaluation on Node 24.22.0

Date: 2026-10-19. The [Node baseline design](NODE_24_BASELINE_DESIGN.md) includes
a new independent local PR evaluation. Fresh GitHub MCP open inventory [50, 48]
and unfiltered random draw 0.07849623494184943 selected
[PR 50](https://github.com/cloudbyday90/Harmoniarr/pull/50).
Current immutable base: 6f7a1591751aa898da5d0f56064000499fabe2cb;
head: b93384863575287255fecbe5af590b4d465c71e4.

## Design and execution

Apply the reviewed PR's JSON delta locally with conflict refusal, preserving
the current Node engine floors and validation scripts. Back up both package
files and hash the opening/candidate pair. Install with lifecycle scripts
disabled. Exercise the actual Vue 3.5.44/Router 5.4.0 published pair in Chromium
using project-scoped Node 24.22.0 and current Playwright 1.64.1.

The [official upstream issue](https://github.com/vuejs/router/issues/2851)
is closed, but a fresh check of its exact composition still produces
`Cannot read properties of null (reading 'getRootNode')` when nested navigation
synchronously renders an async-setup component as its only root below a resolved
ancestor Suspense. A fresh-page wrapping-element control renders without errors.
The probe requires both observations; it does not call the exception a passing
application journey or infer that the current product uses the trigger.

## Outcome and recommendation

Reject this candidate and restore both exact pre-evaluation package files,
then reinstall the restored tree. Preserve the qualified development tools from
PR 45 and the new Node metadata. Do not patch vendor distributions, add an
unnecessary app wrapper or promote the candidate because the issue is closed.
The [earlier PR 50 outcome](OPEN_PR_50_LOCAL_EVALUATION_OUTCOME.md) remains
historical evidence on another head/toolchain, not a substitute for this run.

Artifacts remain ignored under .tmp/node-baseline-2026-10-19: immutable PR/delta
manifest, opening package bytes, candidate and restored install logs, native
Chromium probe and bounded two-case result. Final restored application validation
is recorded in the [Node outcome](NODE_24_BASELINE_OUTCOME.md).

Retaining 5.2.0 avoids the observed composition failure; it defers newer Router
features and requires requalification of a repaired published version. No PR
merge, closure, rebase, release or new branch is part of this evaluation.
