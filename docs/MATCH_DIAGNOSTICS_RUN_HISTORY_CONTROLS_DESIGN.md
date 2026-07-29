# Match Diagnostics Run History Controls Design

## Status

Implemented on 2026-07-29.

## Problem

Match diagnostics correctly became a recovery-first exception surface, but its
three historical run workbenches still appeared in full on every visit. Media
checks, download dispatch, and library-add controls made an advanced route look
like the normal path for getting music. Their visible copy also exposed
candidate and import-worker terminology that belongs to implementation detail,
not to a home user's recovery workflow.

Music Queue owns normal release progress. Match diagnostics retains run detail,
manual recovery, and direct run URLs for operators.

## Research

Sources were checked on 2026-07-29 against the requested June 2026 baseline.

| Source | Applied guidance |
| --- | --- |
| [W3C WCAG 2.2 Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels) | The collapsed section has one descriptive heading and concise scope so operators can predict its contents. |
| [W3C WAI-ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | A native `details`/`summary` disclosure provides an accessible keyboard-operable progressive-disclosure boundary without custom ARIA state management. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | The default summary contains no source paths, provider payloads, or file-level evidence. That information remains inside authenticated diagnostic panels. |

## Options

### Keep all three workbenches visible

Pros: one click fewer for specialist actions; no layout change.

Cons: normalizes manual intervention, produces a crowded diagnostic route, and
competes with Music Queue.

### Move run history to a separate route

Pros: strongest separation between normal diagnostics and historical control.

Cons: adds navigation before direct recovery and risks breaking useful
query/hash run links.

### One progressive run-history disclosure

Pros: preserves existing panels, actions, panel IDs, and deep links while
making exceptional controls quiet by default.

Cons: an operator opens one disclosure before manually checking media,
dispatching a download, or adding files. That is appropriate for exception
work.

## Final Recommendation Stack

1. Keep Music Queue as the normal release workflow and Match diagnostics as an
   admin-only exception route.
2. Place media checks, download dispatch, and add-to-library run history under
   one collapsed `Run history and controls` disclosure.
3. Automatically expand the disclosure for `mediaInspectionRunId`,
   `executionRunId`, or `applyRunId` route state so direct links remain
   complete and usable.
4. Use visible language of `matches`, `downloads`, and `add to library`; retain
   existing candidate and apply identifiers only as internal API and database
   contracts.
5. Keep manual controls inside the disclosure. No normal automatic path should
   require them.

## Implementation

- `import-review-runway-presentation.js` is a small ESM presentation helper
  that identifies direct run route state.
- `ImportReviewView.vue` owns the native disclosure and opens it for direct
  run links or in-page panel navigation. Existing IDs, query keys, hash links,
  and admin workflow event handlers are unchanged.
- The existing evidence disclosure now keeps its own local open state, while a
  direct affected-file link still opens it automatically. Normal operator
  clicks therefore remain open through later view updates.
- The three existing run panels retain their components and controls, but their
  headings now say `Check selected matches`, `Send selected matches to
  downloads`, and `Add downloads to library`.
- Status panels and notices use the same match/download/library language.

## Security Boundary

This is a presentation-only change. It creates no API route, mutation,
persistence field, or provider call. The existing admin conditional still
controls visibility, while fresh-session, CSRF, and server-side authorization
continue to enforce every run action. A deep link can expand a disclosure only
for an already authorized operator; it does not reveal runs to a requester or
non-admin user. Raw evidence remains in its existing authenticated panels and
is not copied into the disclosure summary.

## Verification

- Client tests cover ordinary route state remaining collapsed and each direct
  run state expanding the disclosure.
- Browser tests verify a normal admin visit starts collapsed, direct media,
  download, and add-to-library links open the disclosure, and existing panel
  controls continue to work after expansion.
- Client lint, test lint, client build, focused browser checks, full tests,
  ESM checks, and the local walkthrough Docker build are release gates.

## Outcome

Match diagnostics now has one quiet entry point for specialist run history and
manual controls. Normal automatic progress remains in Music Queue, while
operator run links and recovery controls remain available without exposing an
always-visible workbench.

## Next High-Value Item

Reduce the remaining raw match queue/filter rail inside Match diagnostics to a
compact, disclosed `Find a match` diagnostic tool, while preserving direct
candidate and file recovery links. This completes the recovery-first hierarchy
without removing evidence needed for exceptional diagnosis.
