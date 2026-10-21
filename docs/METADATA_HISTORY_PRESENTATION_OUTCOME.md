# Metadata history presentation outcome

Date: 2026-10-21. See the [design](METADATA_HISTORY_PRESENTATION_DESIGN.md) and
[official sources, tradeoffs and recommended stack](METADATA_HISTORY_PRESENTATION_RESEARCH_2026_10.md).

## Result

Recent discoveries now gives each event a description list containing Release
type, Detected, Monitoring decision and Wanted state. Labels and values stack,
entries have token-based separation, and long unbroken titles wrap. The small
entry component resolves its existing release-group link once per reactive
update. It preserves the original list, decision copy and navigation contract.

A small ESM formatter and timestamp component serve both detection history and
Last refresh/Next refresh. Visible time follows the browser locale/timezone,
includes seconds and an explicit offset, and retains a normalized UTC instant
in time[datetime]. Explicit factory options qualify deterministic locale/timezone
behavior. Missing, malformed, impossible and zone-less inputs render ordinary
context-specific fallback text without a time element. Input precision and
year bounds are documented in the design. The loaded application caches its
formatter; changing the host locale/timezone requires reloading it.

The policy's two timestamp values span their card below the labels, avoiding
the generic two-column layout's narrow value column at desktop widths. Other
policy fields keep their compact columns. The changes add no dependency, timer,
backend, schema, read/mutation behavior or authorization mechanism. Provider
titles remain escaped text. Existing page generations, status and owned focus
are unchanged and retain their native browser qualification.

The project [web standards skill](../.agents/skills/harmoniarr-web-standards/SKILL.md)
now records semantic detail groups, explicit-zone timestamp boundaries, DST and
literal-text checks, narrow layouts and freezing bytes before browser builds.
Its structural validator passed.

## Validation and retained failures

- One native pre-change reproduction failed on the absent detail labels. Its
  original source and log are retained privately.
- Focused selection: 34 passed, including six new timestamp cases and existing
  artist presentation, pagination and feedback/focus cases. New cases cover
  exact UTC/offset identity and millisecond preservation, missing/invalid input,
  impossible calendar dates, leap days, zone-less refusal, non-string coercion
  refusal, locale variation, midnight crossing and repeated New York DST times
  with different offsets. Initial runs exposed numeric-hour padding and zero
  offset label assumptions. The formatter now requests two-digit hours; the
  UTC assertion accepts the valid GMT and GMT+0 labels while retaining exact
  machine instants and nonzero-offset checks. Failed logs are retained.
- The initial 15-case browser run passed all 14 existing consumers and the new
  case's structure, time, text-safety and layout assertions. Its last navigation
  assertion failed because Saved group names two headings. Scoping the heading
  to the Selected release group panel fixed the assertion; the affected case
  then passed alone. This was a test correction, not a route change.
- Visual review then identified squeezed policy timestamps at desktop four-card
  widths. After the full-width timestamp adjustment and added geometry checks,
  all 15 unique browser cases passed together in about 70 seconds. One new case
  verifies semantic label/value groups, localized labels with visible offsets,
  exact normalized history/policy datetime values, invalid/missing fallback,
  literal HTML-like provider text, long-title wrapping, keyboard release-group
  navigation, no mutation dispatch and no browser errors. Fourteen existing
  history/focus, command authority/selection and cache consumers also passed.
  Repeated runs are not counted as additional unique coverage.
- Twelve history/policy captures cover 390, 768 and 1280 px in both light and
  dark themes. Native geometry checks verify stacked terms/values, full-width
  policy times and absence of horizontal overflow in the tested entries.
- Native sessions, HTTP routes and responses use controlled catalog/history
  services. This establishes UI and HTTP behavior, not durable detection-event
  storage, provider ingestion or worker completion. DOM/geometry checks do not
  establish actual screen-reader output or complete WCAG conformance.
- One stable final `npm run validate:fast`: 10,742 passed; server 5,592,
  client 4,453, scripts 697; zero failed/cancelled/skipped. Node baseline,
  copyright, migrations/schema, ESM, image/topology, full lint, hygiene and both
  builds passed. The 225 existing Vue warnings remain. All 155 browser-tested
  client artifacts match the final fast build byte for byte. Source line endings
  were frozen before the final browser build, avoiding the preceding round's
  artifact mismatch. No timeout, worker count or skip was loosened; these runs
  do not establish a matched whole-suite speed improvement.

Final frozen source: 3,201 files,
`279ac6e88ff6515fd0d7e02f0b78ed43dfb5c476b37abd5640a030dd86e329cd`.
Seven resulting code/test/fixture files are byte-verified through staging.
Private failed and passing evidence remains in
`.tmp/metadata-history-presentation-2026-10-21/`.
See the separate [Docker outcome](LOCAL_DOCKER_METADATA_HISTORY_PRESENTATION_OUTCOME.md).

## PR applicability and next item

MCP returned zero open PRs, so no random candidate, rebase, merge or stale closure
was applicable. Work stays on main without a release, Git tag or version bump.

Completed by the [history panel outcome](METADATA_HISTORY_PANEL_OUTCOME.md):
history now occupies its own full-width named section after the finite summary.
That outcome records responsive geometry, retained focus/read behavior and the
next follow-up.
