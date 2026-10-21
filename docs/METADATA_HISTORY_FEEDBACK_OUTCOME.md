# Metadata history feedback and focus outcome

Date: 2026-10-21. See the [design](METADATA_HISTORY_FEEDBACK_DESIGN.md) and
[official research, tradeoffs and recommendation stack](METADATA_HISTORY_FEEDBACK_RESEARCH_2026_10.md).

## Result

Metadata history now reports progress, appended entry counts, exhaustion and
retry failures through one persistent polite, atomic status container outside
the busy list. Existing workspace/page generations own the messages and clear
them when authoritative history resets. Obsolete work cannot publish feedback.

A small ESM focus composable waits for the page and Vue's DOM update, then
rechecks page currency and the existing user-interaction tracker. Continuing
pages and failures restore the surviving Load more history button. A final page
that removes the button moves owned focus to Recent discoveries. Its heading
has a visible focus indicator and a negative tabindex, and scrolls into view
when history is long. A user's move elsewhere remains respected. Focus listeners
retire on every exit, including an unexpected Error or null rejection.

The view owns focus wiring, the history reader owns completion/status, and the
summary component exposes its surviving heading. No backend, schema, dependency,
session/CSRF, read bounds or authorization change was needed. The project
[web standards skill](../.agents/skills/harmoniarr-web-standards/SKILL.md) now
records stable status, repeated currency checks, long-history visibility and
the distinction between DOM evidence and assistive-technology qualification.
Its structural validator passed.

## Validation and retained failures

- The original native keyboard reproduction failed against the prior code:
  final-page button removal did not focus the surviving history heading. The
  exact initial reproduction source and log are retained privately.
- Final focused selection: 89 passed. Nine new cases cover progress/count/end,
  empty/singular pages, retry/cancellation, duplicate/obsolete completion, reset,
  focus destinations and scroll options, explicit user movement, currency after
  command completion, disconnected targets and Error/null cleanup. Existing
  history/workflow, command authority/selection, request gate, API, route-state
  and focus-tracker consumers remain in the selection.
- The first combined browser run passed 12 of 14 cases. One new case incorrectly
  waited for visibility of an initially empty status container; it now checks
  attachment. Another incorrectly tracked an intentionally rejected service
  promise as a fixture failure. Its observer now verifies that exact expected
  error while the original rejection still reaches the native HTTP handler.
  All five new cases then passed. Review subsequently corrected heading scrolling
  and added a long-history viewport assertion and focused scroll-option checks.
- Browser cohort after the scroll correction: all 14 unique cases passed in about
  58 seconds. Five new
  cases prove persistent status-node identity, loading outside busy content,
  final/non-final keyboard focus, a native 500 followed by same-cursor retry,
  zero-entry completion, and user movement during held success and failure.
  Nine existing history, command authority/selection and cache cases also passed;
  reselection additionally proves obsolete feedback stays cleared. Repeated
  executions are not counted as new coverage.
- The final artifact check found that source line-ending normalization between
  that browser build and the fast build changed generated client hashes. The
  earlier artifact manifest and mismatch are retained. The same 14-case cohort
  was therefore repeated against the exact final client packaged in Docker;
  all 14 passed. That manifest is checked against the final build and image.
- Native sessions, HTTP guards and responses use controlled catalog/history
  services. These checks establish UI ownership and HTTP behavior, not durable
  detection-event storage, MusicBrainz ingestion or worker completion.
- Inspected completion captures at 390 px light, 768 px dark and 1280 px dark,
  plus retry failure at 390 px light. The long-history case verifies the heading
  is in the viewport after focus, before screenshot scrolling.
- One final `npm run validate:fast`: 10,736 passed; server 5,592, client 4,447,
  scripts 697; zero failed/cancelled/skipped. Node baseline, copyright,
  migrations/schema, ESM, image/topology, full lint, hygiene and both builds
  passed. The 225 existing Vue warnings remain. All 155 final browser-tested
  client artifacts match the final fast build and image byte for byte.

Final frozen source: 3,196 files,
`57fae0acfe73e541508377e535728ae32f86616634029ea2f457e27923a2a375`.
Eight resulting code/test files are byte-verified through staging. Private
failed and passing evidence remains in `.tmp/metadata-history-feedback-2026-10-21/`.
See the separate [Docker outcome](LOCAL_DOCKER_METADATA_HISTORY_FEEDBACK_OUTCOME.md).
No timeout, worker count, assertion threshold or skip was loosened. These checks
do not establish actual screen-reader announcements, complete WCAG conformance,
the full browser/database/provider matrix or a matched suite speed improvement.

## PR applicability and next item

MCP returned zero open PRs. No random candidate, merge, rebase or stale-PR closure
was applicable. Work stays on main without a release, Git tag or version bump.

Completed by the [history presentation outcome](METADATA_HISTORY_PRESENTATION_OUTCOME.md):
entry details now have semantic separation and readable absolute timestamps,
retaining current pagination and focus ownership. That outcome records the next
follow-up and remaining qualification limits.
