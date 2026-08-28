# Missing Music Browser Acceptance Modernization — Outcome

**Status:** Implemented and validated
**Date:** 2026-08-28

## Intended result

The browser suite no longer exercises the retired Music Queue DOM or its
obsolete acquisition-release presentation fixtures. It retains supported
legacy-route redirects as narrow compatibility checks and verifies the
canonical Missing Music release-detail link through its accessible name and a
2px visible keyboard focus indicator.

The retained `/app/activity/queue` check now follows the actual supported
route: `/app/missing`, preserving its query and fragment state. This keeps
saved historic links covered without referring to the retired Acquisition
worklist.

## Validation record

- The four retired Music Queue modules reproduced seven failures before removal.
  Every failure waited for removed `.music-queue-*` controls after the browser
  had correctly redirected to Missing Music.
- An initial full browser command exposed the stale Activity queue assertion.
  It was reproduced in isolation, corrected to the supported Missing Music
  destination, and retained as a compatibility test.
- The seven changed browser scenarios passed together: Activity queue redirect,
  Missing Music worklist, legacy release redirect, and four release-detail
  workflows. The release-details link now proves both keyboard focus and its
  2px indicator.
- `npm run validate` passed: policy and migration checks, schema snapshot, ESM,
  Compose policy checks, all lint and test-hygiene gates, server/client/script
  tests, 37 integration tests, and client/server production builds.
- The complete 76-module browser command was not allowed to continue after its
  initial stale assertion failed; the corrected affected modules were run to
  completion. This prevents a known obsolete assertion from consuming the
  serial full-browser runtime while retaining focused acceptance evidence.

## Open PR assessment

GitHub CLI listing remains unavailable because its credentials return
`HTTP 401`. The locally reachable Dependabot PR #41 was inspected without
merging. Its `@vue/language-server`, `eslint`, and `globals` upgrades are
already present on `main`, so it is stale and no local PR patch was applicable.

## Security and accessibility outcome

- The canonical browser handoff continues to expose only opaque decision IDs,
  not provider identifiers or credentials.
- The Activity and Music Queue compatibility aliases retain only ordinary query
  and fragment state; authorization remains server-owned.
- The named release-details control has a 2px `:focus-visible` ring, matching
  the project's keyboard-focus contract without changing pointer styling.

## Next recommended work

Decide whether the remaining serial browser-suite runtime should be reduced by
making each isolated browser runtime close promptly after its module completes.
This is test-infrastructure work, not a product-route change: it should first
measure the current per-module teardown delay and preserve temporary PostgreSQL
isolation before any concurrency change is considered.

## Related design

See [Missing Music Browser Acceptance Modernization Design](MISSING_MUSIC_BROWSER_ACCEPTANCE_MODERNIZATION_DESIGN.md).
