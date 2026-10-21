# Metadata history compatibility lane design

Date: October 21, 2026. Follows the next item in the
[visibility outcome](METADATA_HISTORY_VISIBILITY_OUTCOME.md). See the separate
[official research](METADATA_HISTORY_COMPATIBILITY_RESEARCH_2026_10.md).

## Scope and ownership

Qualify the existing owned-focus history journey in bundled Chromium, Firefox
and WebKit. Keep a small explicit compatibility command outside test/browser so
the routine Chromium gate does not acquire three-engine installation or matrix
cost. Do not migrate from node:test or add another test framework/dependency.

The native matrix covers long continuing append and final heading focus at
1280x720, 390x720 and 320x256 CSS pixels; an already-visible continuing control;
and a held page after the user moves elsewhere. Preserve real session/HTTP and
page-generation ownership with controlled catalogue data. These are read-only
history journeys, not provider import or persistent event-store qualification.

Provide an explicit browserType capability to the existing smoke runtime,
defaulting to Chromium. Extract a small ESM browser-session owner so launch,
context creation, route installation and page creation all live inside cleanup
ownership. The old finally began after those setup steps. Attempt route removal,
context close and browser close; preserve the first original Error/null and
report cleanup failure if the scenario otherwise passed. No environment-wide
engine override or production authorization change is needed.

## Geometry and zoom claims

Measure rendered focus identity, outline and bounds against the actual workspace,
fixed navigation and DOM viewport. Test horizontal content overflow as well as
the root; overflow-x:clip must not hide a failure from a root-only check. Do not
repair post-response geometry with Playwright's scrolling helper.

The compatibility investigation also reproduced a programmatically focused
Metadata field under WebKit's fixed bottom navigation. Mobile scroll clearance
belongs to the shell's actual .hx-main scroll container: add scroll-padding using
navigation height, safe-area inset and the existing 16px spacing token. Retain
the same ordinary top inset so an upward focus scroll does not clip the field's
outer border above the scrollport. Retain
ordinary padding for scrollable room. Remove the history button's duplicate
navigation-height scroll margin, keeping its ordinary 8px target margins. This
affects native focus/scroll positioning across mobile views and requires the
default Chromium consumers as well as the engine matrix. It changes no layout
height or command authority. Wait for actual focused-field visibility before
measuring reading position; WebKit can scroll on a later rendered frame.

320 CSS pixels is a reflow case, not proof that browser zoom was changed.
Separately investigate actual 400% Chromium tab zoom using the vendor Tabs API
in a fresh fixture-owned profile and extension. Record getZoom and effective
viewport dimensions. Do not modify CSS zoom, substitute deviceScaleFactor, or
send a DOM keyboard shortcut and assume the browser shell changed zoom.
The test-only MV3 module has no extension permissions or page messaging. Require
one owned page, set per-tab zoom, and remove its verified temporary profile only
after context close and observed browser disconnection. Retain the profile if
retirement is uncertain. The native zoom case belongs in the explicit lane too.

Bundled WebKit is engine evidence, not released Safari or iOS device proof. A
nonzero safe area and actual screen-reader announcements require their own
manual/device session. Record those as unperformed when unavailable. Include a
practical manual acceptance procedure in the outcome; do not invent a passing
assistive-technology result from DOM roles or ARIA snapshots.

## Validation and publication

Retain baseline diagnostics and failures. Prove session setup/cleanup ordering
and Error/null with controlled capabilities, then execute the native matrix and
affected default Chromium consumers. Freeze the final source before building;
run one complete fast gate and the preserved-state no-cache Docker walkthrough.
Keep browser versions, rendered artifacts, source hashes and unperformed checks
separate. Publish all intended changes on main without a release or branch.
