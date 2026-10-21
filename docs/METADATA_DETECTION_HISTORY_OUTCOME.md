# Metadata detection-history ownership outcome

Date: 2026-10-21. See the [design](METADATA_DETECTION_HISTORY_DESIGN.md) and
[official research, tradeoffs and recommendation stack](METADATA_DETECTION_HISTORY_RESEARCH_2026_10.md).

## Result

`useMetadataDetectionHistory` now owns pagination in a small ESM composable, with
injected catalog state, workspace capture and read service. The artist workflow
retains its public view contract and delegates page info, error, pending state
and load-more handling. Its existing navigation/catalog paths reset the reader
before a new workspace starts and whenever authoritative history is replaced.

Each page captures artist/cursor and both workspace/page generations. The GET
receives a page AbortSignal, while generation checks guard event append, cursor,
error and pending cleanup even when cancellation is ignored. A current failure
keeps its cursor for retry; expected aborts stay silent. Same-ID reselection and
same-generation catalog replacement retire the old page. No backend, schema,
dependency, command/CSRF or route-authority change was needed.

The project [web standards skill](../.agents/skills/harmoniarr-web-standards/SKILL.md)
now routes pagination work to the dual-owner/reset contract and distinguishes
controlled-page native evidence from durable store proof. Its structural
validator passed; no global skill installation was needed.

## Validation

- All seven new race cases failed against the prior implementation. Their exact
  source is retained with the reproduction log. They cover stale events/cursors,
  same-ID reselection with a new page pending, obsolete failures, current failure/
  retry/abort, catalog replacement, a missing workspace and unfinished navigation.
- Final focused selection: 76 passed, including those seven cases and existing
  artist/release workflows, command authority/selection, gate, API and route-state
  consumers. The ordinary append test still verifies the target, cursor, events
  and page info, now also checking that the adapter receives an AbortSignal.
- Selected browser cohort: all nine unique cases passed on the first execution
  in about 45 seconds. Two new cases retain operator keyboard pagination, native
  anonymous 401 before owner dispatch, two native 200 pages with ordered cursors
  and the server's default limit of ten, final-button removal, and no mutations
  during ordinary paging. Reselection aborts a held native GET; the controlled
  service then returns after that abort without changing current history or
  stealing focus. A new page starts from the fresh cursor and appends normally.
  Seven existing command authority/selection and cache consumers also passed.
- Browser sessions and HTTP guards are real, with controlled catalog/page owners.
  This proves read admission, request/cursor flow and UI ownership, not durable
  detection-event storage, MusicBrainz imports or worker completion. The held
  aborted GET is not claimed to have delivered a successful HTTP response.
- Initial focused lint found two shadowed test bindings; renamed them before
  browser execution. Final full `npm run validate:fast`: 10,727 passed; server
  5,592, client 4,438, scripts 697; zero failed/cancelled/skipped. Node baseline,
  copyright, migrations/schema, ESM, image/topology, full lint, hygiene and both
  builds passed. The 225 existing Vue lifecycle warnings remain.
- All 155 browser-tested client artifacts match the final fast build byte for
  byte. No application templates or styles changed. No timeout, worker count,
  assertion threshold or skip changed, and no passing browser cohort was repeated.

Final frozen source: 3,193 files,
`355aee8cb11678a0705b1352e0d9ee620d9b0c1792d260df0162765e9a1d683d`.
Six resulting code/test files are byte-verified through staging. Private failed
and passing evidence remains in `.tmp/metadata-detection-history-2026-10-21/`.
See the separate [Docker outcome](LOCAL_DOCKER_METADATA_DETECTION_HISTORY_OUTCOME.md).
These selected checks do not establish the complete browser/database/provider
matrix, assistive-technology output, general WCAG conformance or a matched
whole-suite speed improvement.

## PR applicability and next item

MCP returned zero open PRs. No random candidate, merge, rebase or stale-PR closure
was applicable. Work remains on main with no release, Git tag or version bump.

Next, qualify history completion feedback and keyboard focus. The current
component removes Load more history on the final page; the new browser test
verifies that removal but does not qualify the resulting focus handoff or an
assistive-technology announcement. Add meaningful completion/error status and
owned focus handling without interrupting a user who has moved elsewhere. Keep
the current page/artist ownership contract and verify announcements separately
from DOM/ARIA assertions before claiming accessibility conformance.
