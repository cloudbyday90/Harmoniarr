# Metadata continuing-page focus visibility outcome

Date: October 21, 2026. Implements the next item in the
[panel outcome](METADATA_HISTORY_PANEL_OUTCOME.md), following the separate
[design](METADATA_HISTORY_VISIBILITY_DESIGN.md) and
[official research/tradeoffs](METADATA_HISTORY_VISIBILITY_RESEARCH_2026_10.md).

## Result

Successful continuing pages now keep their keyboard invoker visible through
native instant nearest scrolling. A button that retained focus while moving is
covered too. The existing ESM composable keeps current-page and interaction
authority, then rechecks both after synchronous focus handlers. Disabled,
detached, stale/no-op and user-abandoned interactions cannot reveal the button.
Final heading focus and failed/cancelled retry behavior retain their own paths.

The panel's scoped scroll margins use existing spacing/mobile navigation tokens
and safe-area inset. Its button shares the heading's two-pixel accent focus cue.
No global scroll manager, observer, timer, dependency, server file or schema
change was needed. Server permission and CSRF checks continue to own command
authorization independently of browser focus. The selected native tests keep
history reads separate from command dispatch.

The recommended stack combines WCAG focus outcomes, WHATWG focus semantics,
CSSWG nearest scrolling/margins, existing Vue/current-generation ownership,
OWASP server authorization and IETF safe-read semantics. This gives a small,
bounded implementation and preserves already-visible reading position. Its
tradeoff is following the invoking button past the newly appended rows; other
engines and real assistive technology still need qualification. The
[standards skill](../.agents/skills/harmoniarr-web-standards/SKILL.md) now routes
to this practical workflow and distinguishes focus identity from visibility.
Skill validation passed; the change is narrow and did not need another skill
or independent agent evaluation.

## Executed validation

- Retained two old-client native failures: the initial check found its one-pixel
  default outline; the next check isolated the off-screen button after a ten-entry
  append. Neither failing log was replaced by a later successful run. A focused
  lint run also caught two shadowed test variables, which were corrected.
- All 37 selected client checks passed, including retained focus without another
  focus call, synchronous redirection/invalidation, stale/no-op refusal, detached/
  disabled targets, user movement, retry/cancellation and original Error/null.
- All 20 native Chromium cases across seven files passed. The expanded eight-case
  feedback suite proves ten initial plus ten appended events at 1280x720 and
  390x720, visible keyboard outline above mobile navigation, unchanged scroll for
  an already-visible empty continuing page, final heading focus, native 500 retry,
  and held final/continuing/failed responses after the user moves elsewhere.
  Remaining consumers prove session refusal, current selection/abort, command
  authority/CSRF, panel layout, entry presentation and cache baseline controls.
  The two new visibility captures were visually inspected. Post-response checks
  do not use a test scroll helper to repair the application's result.
- One stable complete `npm run validate:fast`: 10,745 passed (5,592 server,
  4,456 client, 697 scripts), zero failures/cancellations/skips. Baseline,
  copyright, migrations/schema, ESM, image/topology, lint, hygiene and both builds
  passed. The 225 existing Vue warnings remain. All 155 browser-tested client
  artifacts match the final fast build exactly. No timeout, worker count,
  assertion or skip was relaxed. These selections do not measure a whole-suite
  speed improvement; the full PostgreSQL suite was not rerun for this UI change.

Frozen source: 3,203 files,
`ad3b8bc4a3e7f33c6178a80bba8cdcaad261430f5f150fb54bf5f50b236dfa2e`.
Four code/test files are checked against the frozen candidate through staging.
Installed versions: Node 24.22.0, Vue 3.5.44, Router 5.2.0, Playwright 1.64.1.
Private evidence is under `.tmp/metadata-history-visibility-2026-10-21/`.
The separate [Docker outcome](LOCAL_DOCKER_METADATA_HISTORY_VISIBILITY_OUTCOME.md)
records packaged bytes, preserved state and actual readiness.

## PR applicability and next item

MCP returned zero open PRs. No random candidate, stale closure, rebase or merge
was applicable. Work remains on main without a release, Git tag or version bump.

Next: qualify this bounded focus/scroll policy in Firefox and WebKit, then check
actual zoom and an assistive-technology session. Start with the same long-append,
already-visible and user-moved controls, including a device with a nonzero safe
area. Current automated geometry does not prove screen-reader announcements,
400% browser zoom, every engine or complete WCAG conformance. Keep that optional
compatibility lane separate from the routine Chromium selection so ordinary
feedback remains focused; use failures to choose the next code change.
