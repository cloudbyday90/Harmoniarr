# Match Diagnostics Filter Hierarchy Design

## Status

Implemented on 2026-07-29.

## Problem

Before this change, `Find a match` exposed four equally weighted fields in one grid:
status, folder path, source search reference, and source user. The latter two
are provider-record identifiers that are valuable during a specific
investigation, but they distract from the common diagnostic question: which
saved match should be reviewed next?

The form must remain available to administrators without changing deep-link
query parameters, candidate selection, or server filtering behavior.

## Existing Contract

- `status` constrains the saved-match state.
- `folderPath` performs a case-insensitive contains search against the saved
  folder path.
- `sourceSearchId` is an exact saved provider-search reference.
- `username` performs a case-insensitive contains search against the source
  user.
- All four values are normalized in the Match diagnostics route state and are
  retained in a deep link after the form is submitted.

## Research

Sources were checked on 2026-07-29 against the requested June 2026 baseline.

| Source | Applied guidance |
| --- | --- |
| [W3C WAI Forms Tutorial](https://www.w3.org/WAI/tutorials/forms/) | Keep the primary form short, group related controls with `fieldset` and `legend`, and provide instructions that explain the task. |
| [W3C WAI Labeling Controls](https://www.w3.org/WAI/tutorials/forms/labels/) | Use visible, explicitly associated labels for every search control rather than relying on placeholders or raw query-key names. |
| [W3C WAI-ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Use a native disclosure for optional source-detail filters so its state and keyboard behavior remain standard. |
| [W3C WCAG 2.2 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Keep the DOM and tab order aligned with the reading order: primary search fields, optional filters, then search actions. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Treat source usernames and paths as operational evidence; avoid copying them into summaries or adding client-side logging. |

## Options

### Keep one four-field grid

Pros: all filters are immediately available; no interaction is needed for a
specialist query.

Cons: raw identifiers carry the same visual weight as common search controls,
which makes an exceptional recovery form look more complicated than it is.

### Replace the form with a single unstructured text search

Pros: visually minimal and familiar.

Cons: requires a new server search contract, makes status intent ambiguous,
and weakens exact lookup by a saved provider search reference.

### Use a primary form with an optional source-detail disclosure

Pros: keeps the common status and folder search easy to scan, preserves every
existing filter and route, and exposes raw identifiers only when an operator
needs to diagnose saved provider evidence.

Cons: using a source search reference or source user takes one extra expand
interaction. That cost is appropriate for an advanced recovery tool.

## Final Recommendation Stack

1. Rename the finder entry point to `Search saved matches` and retain its
   native disclosure behavior.
2. Make `Show` (saved-match status) and `Folder contains` the primary form.
   Explain that folder search matches saved folder text rather than the music
   library itself.
3. Place `Search reference` and `Source user` inside a nested native `More
   filters` disclosure with concise specialist-only instructions.
4. Automatically expose `More filters` when a deep link already carries a
   source search reference or source user, so no active restriction is hidden.
5. Use the action labels `Search saved matches` and `Clear search`.
6. Preserve current events, route-query names, server-side exact/contains
   matching semantics, authorization, and selection behavior.

## Security Boundary

This is a client presentation refactor. It adds no route, mutation, provider
call, persistence, authorization rule, or logging. Source user text, provider
search references, and folder-path evidence remain inside the existing
administrator-only Match diagnostics route. No identifier is promoted to the
page header, recovery summary, Music Queue, or Activity timeline.

## Verification Plan

- Browser coverage proves the primary form exposes only the common controls by
  default, `More filters` reveals the raw identifiers on demand, and an
  identifier-bearing direct route opens the secondary disclosure.
- Browser coverage proves `Search saved matches` preserves route-backed filter
  submission, current recovery selection, and mobile reflow without overflow.
- Client and test lint, ESM checks, production build, focused browser tests,
  full tests, production dependency audit, and local Docker walkthrough
  rebuild are release gates.

## Outcome

Match diagnostics now presents a short primary saved-match search, rather than
a four-field diagnostic grid. The ordinary flow starts with a status and folder
text search; source search references and source users remain available under
`More filters`. Existing identifier-bearing deep links automatically open that
secondary disclosure, preventing a hidden active restriction.

The refactor also hardened the shared browser Match Finder helper to target
only the outer disclosure summary. Nested native disclosures can now be added
without changing outer open/close behavior.

## Next High-Value Item

Reduce the Music Queue selected-release review hierarchy. The normal release
path is now calmer than Match diagnostics, but its review panel still repeats
status, quality, and advanced-evidence information. Keep one relevant repair
action visible and move deep match evidence behind an explicit advanced
boundary.
