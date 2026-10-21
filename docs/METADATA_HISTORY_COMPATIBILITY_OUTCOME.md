# Metadata compatibility and mobile focus clearance outcome

Date: October 21, 2026. Follows the [visibility outcome](METADATA_HISTORY_VISIBILITY_OUTCOME.md),
the separate [design](METADATA_HISTORY_COMPATIBILITY_DESIGN.md) and
[official research/tradeoffs](METADATA_HISTORY_COMPATIBILITY_RESEARCH_2026_10.md).

## Delivered behavior

The explicit `npm run validate:metadata-history-compatibility` lane uses bundled
Chromium, Firefox and WebKit with native sessions/HTTP and controlled catalogue
data. It stays outside the default browser glob, so routine feedback retains
its Chromium-only browser requirement. Install the optional engines with
`npx playwright install chromium firefox webkit`; on supported Linux hosts use
Playwright's documented host-dependency installation too. Missing tools fail
this explicit lane rather than turning its cases into passing skips.

The investigation found native WebKit focus could put Artist name beneath the
fixed mobile navigation or partially above the scrollport. Shared .hx-main
mobile scroll padding now reserves top breathing room and bottom navigation/
safe-area clearance. The button keeps ordinary target margins; its duplicated
navigation-height margin was removed. There is no new scroll manager, observer,
timer or dependency. Server authorization/CSRF and read-only history ownership
remain independent of browser capabilities and continue to have native checks.

The smoke runtime now accepts an explicit browserType while keeping Chromium as
its default. A small ESM browser-session service owns setup as well as returned
work and cleanup. It closes an owned browser after failed context creation,
attempts all retirements, preserves original Error/null, and reports cleanup
failure after an otherwise successful body. The old cleanup boundary began
after context/route/page setup and swallowed close errors.

Actual 400% Chromium tab zoom uses the native Tabs API in a fresh owned profile
with a permission-free test-only MV3 module. It verifies per-tab zoom, an exact
320x256 effective CSS viewport, focus, full outline and reflow. Browser retirement
is registered before awaiting launch, and the temporary profile is removed only
after acknowledged context close and browser disconnection. Uncertain retirement
retains that profile. It never loads an extension into a personal browser.

## Executed evidence and retained failures

- Initial read-only diagnostics passed nine engine/viewport cells for long
  continuing append and final heading focus. They did not test field focus.
- The first formal compatibility candidate passed 15/16. An initial private
  zoom probe also failed an exact numeric comparison: requesting 4 returned
  3.9999999999999996. The native test uses a machine-precision bound for that API
  result and still requires exact effective dimensions and full target geometry.
- Later candidates retained both a 16/16 run and another 15/16 failure. A bounded
  seven-case diagnostic retained 6/7, capturing a focused field at y=46.97 while
  the workspace began at y=56. Separate controls observed bottom occlusion and
  native focus scrolling on a later frame. These observations do not certify
  the precise scheduling cause of the first historical reading-position failure.
  Final tests require visible field focus before capturing reading position;
  neither a delay nor a relaxed scroll assertion supplies that prerequisite.
- A focused WebKit inset correction passed 1/1. The final frozen candidate then
  passed all 16 compatibility cases: nine continuing/final geometry cells,
  three already-visible controls, three held user-moved controls and one actual
  tab-zoom case. Executed Windows engines: Chromium 156.0.8078.4, Firefox 157.0,
  WebKit 27.2 with Playwright 1.64.1. No timeout, worker count or skip was loosened.
- All 20 existing Chromium cases across seven files passed on the same final
  source/build, retaining session refusal, command authority/CSRF, selection/
  abort, feedback/retry, layout, presentation and cache baseline coverage.
- All 45 selected client/session checks passed. Six new controlled session cases
  prove returned-work/close drainage, failed setup, original Error/null and first
  cleanup failure while attempting later retirements. They do not certify every
  possible browser/OS failure or a physical assistive-technology session.
- One complete stable `npm run validate:fast`: 10,751 passed (5,598 server,
  4,456 client, 697 scripts), zero failed/cancelled/skipped. Static policy, lint,
  hygiene and both builds passed. The 225 existing Vue warnings remain. All 155
  browser-tested client artifacts match the final fast build exactly. The large
  PostgreSQL suite was not rerun for this UI/fixture change. Keeping the matrix
  optional is a scope/cost decision, not a measured whole-suite speed improvement.

Final source: 3,210 files,
`c82e1560ed83975ede28ccfef46d0dbb0a50796f9c13d92c4cb033e247d07166`.
Eleven code/config/test files are frozen and checked through staging. Private
candidate hashes, failures, diagnostics and screenshots remain under
`.tmp/metadata-history-compatibility-2026-10-21/`. Captures were visually inspected;
full target-outline and content-fit assertions remain the native geometry proof.
See the separate [Docker outcome](LOCAL_DOCKER_METADATA_HISTORY_COMPATIBILITY_OUTCOME.md).

## Recommendation and follow-up

Ship shared CSS scroll clearance, the ESM session lifetime owner and the explicit
compatibility lane. This provides repeatable native coverage without multiplying
routine browser installations. Its costs are optional-engine provisioning and
the shared mobile scroll-positioning scope; it does not establish every route,
released Safari/iOS behavior or complete WCAG conformance. The web standards and
validation skills now record these boundaries. Those skills and the updated
webapp-testing skill passed validation; its stale Playwright version guidance
now points to the installed version and matched browser binaries.

MCP returned zero open PRs on initial and final checks. No random application,
merge, stale closure or rebase was applicable. Work stays on main without a
release, tag, application version bump or dependency change.

Next: execute the prepared [manual accessibility acceptance](METADATA_HISTORY_MANUAL_ACCESSIBILITY.md)
with a real screen reader and a device exposing a nonzero safe area. Actual
screen-reader speech, physical on-screen keyboard behavior, real-device safe
areas and Firefox/WebKit browser-shell zoom remain unperformed. Automated roles,
WebKit on Windows and a 320-pixel viewport cannot stand in for those sessions.
