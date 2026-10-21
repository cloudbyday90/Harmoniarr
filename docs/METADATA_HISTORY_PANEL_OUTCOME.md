# Metadata history panel outcome

Date: 2026-10-21. See the [design](METADATA_HISTORY_PANEL_DESIGN.md) and
[official research, tradeoffs and recommended stack](METADATA_HISTORY_PANEL_RESEARCH_2026_10.md).

## Result

MetadataDetectionHistoryPanel now owns the full-width Recent discoveries section
directly after Artist summary and before release-group browsing. It contains the
existing entry components, persistent polite/atomic status, busy list, empty
message and paging button. The native section takes its accessible name from
the visible heading through a setup-time Vue useId. Its only exposed imperative
interface is getHistoryHeading, used by the existing owned-focus adapter.

MetadataArtistSummary retains its three finite cards and refresh action, with
an Artist summary region label and a component-owned three/two/one-column grid.
Identity spans the last row at two columns. Removing the shared stats-grid class
avoids its odd-child full-row rule at desktop widths. Source and visual reading
order agree; growing history no longer stretches neighboring summary cards.

The ESM view moves history props, the load-more event and the heading ref to the
new panel. Current-page generations, cancellation, status decisions, timestamp
validation, escaped titles, HTTP/session/CSRF and command authority are unchanged.
There is no new data service, endpoint, dependency, timer or nested scroll area.
The project [web standards skill](../.agents/skills/harmoniarr-web-standards/SKILL.md)
now records section/focus ownership, shared grid-rule review, empty history and
viewport qualification limits. Its structural validator passed.

## Validation

- One pre-change native reproduction failed because the history heading was
  contained in the finite summary. Its exact original source and log are retained.
- Focused selection: 34 passed, covering existing artist presentation, timestamp,
  pagination and feedback/focus contracts. No mirrored component unit tests were
  added for the extraction; native layout/interaction checks own that evidence.
  Focused lint found one shadowed test binding; renamed it before browser work.
- All 17 unique browser cases passed together on the first candidate execution,
  in about 81 seconds. Two new cases prove a full-width sibling section, named
  summary/history, a unique stable heading ID, three finite cards, unchanged
  summary height after a final append (eleven total entries), current cursor and
  default page limit, stable status-node identity and final heading focus. Empty
  history keeps its named section and silent status without a list, paging action
  or history page read.
  Fifteen existing history/focus/presentation, command authority/selection and
  cache consumers also passed. No passing browser selection was repeated.
- Sixteen summary/history captures cover 320, 390, 768 and 1280 CSS px in both
  light and dark themes. Native geometry checks verify section order/width,
  bounded summary height, expected card rows and no horizontal overflow in the
  tested summary/history. Narrow viewport evidence does not prove actual 400%
  browser zoom, whole-page WCAG conformance or screen-reader navigation/output.
- Native sessions and HTTP routes use controlled catalog/history services. The
  checks establish UI and request behavior, not durable event storage, provider
  ingestion or worker completion. The separate continuing-page diagnostic below
  is not counted as a passing functional browser case.
- One stable final `npm run validate:fast`: 10,742 passed; server 5,592, client
  4,453, scripts 697; zero failed/cancelled/skipped. Node baseline, copyright,
  migrations/schema, ESM, image/topology, full lint, hygiene and both builds
  passed. The 225 existing Vue warnings remain. All 155 browser-tested client
  artifacts match the final fast build byte for byte. No timeout, worker count,
  assertion threshold or skip was loosened. These selected runs do not establish
  a matched whole-suite speed improvement.

Final frozen source: 3,203 files,
`0560598c0c248e5c89fdfe82115011d1e25fbd5d824d82a15dcad6f4b9d53bc5`.
Four resulting code/test files are byte-verified through staging. Private evidence
remains in `.tmp/metadata-history-panel-2026-10-21/`. See the separate
[Docker outcome](LOCAL_DOCKER_METADATA_HISTORY_PANEL_OUTCOME.md).

## PR applicability and next item

MCP returned zero open PRs; no random candidate, merge, rebase or stale closure
was applicable. Work stays on main without a release, Git tag or version bump.

Next: keep the continuing-page keyboard invoker visible after append. A separate
native diagnostic on this candidate loaded ten more entries with hasMore=true.
The button was initially visible at y=371.19 in a 1280x720 viewport; afterward it
retained focus at y=3124.56, outside the viewport. No metadata mutation was dispatched.
The unchanged focus adapter restores surviving invokers with preventScroll=true;
the final-page path separately scrolls its heading and remains qualified.

Qualify a bounded scroll-to-visible policy only while page and user-interaction
ownership remain current. Preserve a user's move elsewhere, retry/cancellation
behavior and ordinary reading position. Compare scrolling the invoker when it
is outside the visible workspace with always scrolling after append; the former
avoids unnecessary movement when the target is already visible. This diagnostic
does not establish native behavior on older images or every browser. Keep the
fix and its continuing-page viewport proof as the next focused work item.

Follow-up implemented: the [visibility outcome](METADATA_HISTORY_VISIBILITY_OUTCOME.md)
records owned native nearest scrolling, mobile navigation clearance and the
already-visible/user-movement controls. The diagnostic above remains the
historical finding on this panel candidate.
