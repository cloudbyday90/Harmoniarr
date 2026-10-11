# Downloader filter announcement outcome

October 11, 2026, America/New_York. Implementation follows the separate
[design](DOWNLOADER_FILTER_ANNOUNCEMENT_DESIGN.md) and
[official research](DOWNLOADER_FILTER_ANNOUNCEMENT_RESEARCH_2026_10.md).

## Implemented behavior

The actual Vue browser reproduced the original defect before implementation:
the visible queue showed two of four transfers, while the polite status still
said zero of zero. That failing command and native assertion are retained in
`.tmp/downloader-filter-announcement-2026-10-11/browser-red.log` (one failure,
zero skips); no deadline was extended or assertion relaxed.

The fifty-line ESM `useFilterResultAnnouncement` now owns the latest explicit
filter request. It waits for queue/release readiness and current rendering,
then consumes the request once. Failure/context/scope cancellation invalidates
unfinished next-tick publication. Immediate cancellation also prevents a retry
in the same tick from reviving an older filter request. Repeated identical
explicit results still clear and republish; polling and manual refresh create
no announcement intent. Previously loaded visible data remains usable during
revalidation. Existing load-error presentation owns errors.

Downloader retains its native select/checkbox, persistent polite/atomic status
container, text interpolation, focus behavior and existing filtering projection.
The view delegates to the composable instead of accumulating another lifecycle
controller. No auth/CSRF, server, database, provider-command or dependency contract
changed. Queue response gates affect only isolated browser GETs; fixtures do not
issue actual provider searches/downloads.

## Executed validation

- Focused reactive/filter tests: **12/12**, including seven new composable cases
  for readiness, supersession, cancellation, quiet revalidation and disposal.
- Actual Downloader browser suite: **4/4** in 22.49s, zero failures/skips.
  Deferred response yields the latest count and preserves focus; a mutation
  observer sees just one nonempty filter message across periodic GET/manual
  refresh. Failure then retry stays silent until a new explicit filter. Navigation
  removes pending ownership before the next visit. Original loaded filtering,
  linkage and narrow-layout assertions remain.
- Existing disabled-provider and legacy release-handoff browser consumers:
  **2/2** in 21.12s, zero failures/skips. Provider setup and scoped transfer
  outcome remain intact.
- Scoped ESLint passes. The first scoped run caught an unqualified browser
  `MutationObserver` reference in the test; qualifying `globalThis` corrected
  that lint issue without changing browser behavior. Client production build passes.

The old source-text assertion naming the removed local async function was removed;
executed reactive and browser tests now own that lifecycle behavior. Existing
semantic-control and filter-result assertions remain.

The stable `npm run validate:fast` passed **9,548 tests**: 4,612 server,
4,384 client and 552 script tests, zero failures/cancellations/skips. All static
checks, full lint/test hygiene and both production builds passed. Wall time was
**183.14 seconds**. Vite's plugin-timing diagnostic was nonfatal. The complete
serial PostgreSQL gate was not repeated for this client-only slice; the actual
browser cases above exercised isolated PostgreSQL/session startup. This is the
selected validation scope, not a claim that the full database suite ran again.
Npm audit reported zero vulnerabilities; that is not a repository security
certification. All six code files remained frozen through the final gate.

Browser evidence exercises newly built client assets with real isolated
PostgreSQL/app sessions and controlled queue responses. It does not establish
provider integration, screen-reader speech, every canonical handoff journey or
full WCAG conformance. The earlier configured walkthrough image is a separate
deployment; this slice does not claim that image already contains the new client.
No release was created.

## Recommendation stack and limits

Use Vue/native semantic controls, the existing async resource, a narrow local
announcement owner, and current transfer projections. Add observable response
gates/reactive lifetime tests at this seam, followed by the complete fast static/
unit/build gate. Benefits are accurate feedback, usable early controls and quiet
background updates. Costs are an explicit fifty-line owner and focused lifecycle
coverage. Do not replace this with count-wide watchers, disabled controls, longer
timeouts or a global state singleton. No new full-suite speed improvement is
claimed; avoiding unrelated database replay is a validation-scope decision.

The maintained standards skill maps implementation owners and actual evidence
separately from ARIA conformance. Its current metadata/invocation policy remains.
Source/installed structural validation passed, and all four maintained skill
files were synchronized; no new blind skill trial was performed.
The separate [PR outcome](OPEN_PR_APPLICABILITY_DOWNLOADER_FILTER_2026_10_OUTCOME.md)
finds no eligible unreplayed patch after fresh MCP metadata and complete scopes;
no random draw, downgrade, duplicate replay or merge was performed.

Local evidence is under `.tmp/downloader-filter-announcement-2026-10-11/`:
red/green browser logs, focused controls, client build, full fast-gate log/state,
security result, raw official/PR MCP records and code-freeze hashes. Publication
continuity and local document-link checks are recorded separately. Evidence is
kept local; no credentials, raw provider data or browser session was committed.

## Next recommendation

Capture bounded first app-fixture checkout diagnostics: approved error/cause
codes, pool total/idle/waiting counters and owned server phase. Trace actual
invocation/pool drainage before changing test scheduling. The preceding
[catalogue outcome](CATALOGUE_TEST_LIFECYCLE_OUTCOME.md) retains two native setup
failures whose triggers remain unreproduced. After that evidence, compose the
audited four-file PostgreSQL cohort plus an exhaustive disjoint serial remainder
and compare complete-gate counts/timing before promotion. Discovery-request
recomputation remains subsequent product work.
