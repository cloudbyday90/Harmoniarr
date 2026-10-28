# Connections layout outcome

October 28, 2026. See separate [official research/pros and cons](CONNECTIONS_LAYOUT_RESEARCH_2026_10.md),
[design](CONNECTIONS_LAYOUT_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_CONNECTIONS_LAYOUT_OUTCOME.md).

## Implemented result

Connections mobile form fields now use their content height and full row width.
The read-only baseline found 200px field heights and approximately 106px input
heights: the later desktop flex-basis overrode the mobile rule after rows switched
to columns. The corrected mobile Spotify fields measure 56px, with approximately
34px input height, retaining desktop density and wrapping.

Shared row rules moved into [form-layout.css](../src/client/form-layout.css),
loaded after the design system, with the responsive override adjacent to the base.
The superseded rules were removed. Save-bar styling now stays in its component;
the global negative margins that assumed panel padding were removed.

The small ESM [clearance owner](../src/client/lib/sticky-save-bar-clearance.js)
reserves measured sticky height in the actual scrollport, plus breathing room.
Desktop scroll spacing applies only while a save bar exists. Existing mobile
navigation clearance remains. The bar uses normal flow at <=640px width or
<=600px height, and when its height exceeds half the scrollport. This preserves
desktop save access while leaving reading space on constrained viewports.

Border-box observation, render refresh and window resize handle wrapping feedback
and changing actions. Per-scroll-element reservations preserve overlapping mount
ownership. The last owner restores the previous inline value/priority only while
still owned; later foreign writes survive. Setup failure and retirement release
known resources; late callbacks cannot publish. There are no focus-event handlers,
per-control scroll corrections or scripted focus restoration in the application.

Five production client files changed. API/session/CSRF, command/read owners,
settings persistence, schema, maintenance and dependencies are unchanged.
The implemented stack is shared form CSS, the existing save-bar component, scoped
DOM measurement and native CSS scrolling. The benefit is draft-preserving keyboard
clearance with dynamic feedback. The tradeoff is a small measurement lifetime and
a save bar that follows document flow on constrained screens. Alternatives are
recorded in the research document.

## Executed verification

| Boundary | Result |
| --- | --- |
| Focused owner and Settings regressions | 74 tests passed, zero skipped |
| Frozen complete fast gate | 11,726 tests passed: server 6,453, client 4,570, scripts 703; zero failures, cancellations or skips |
| Static/build stages | Node baseline, copyright, migration/schema/anchor, ESM, image/topology, lint, test hygiene and build passed |
| Final combined browser/compatibility command | Nine tests passed in six suites plus the top-level zoom test; zero failures, cancellations or skips |
| Walkthrough layout | 19 scenes passed: eight viewport/boundary sizes in both themes, wrapped save failure, enlarged feedback and a shared General consumer |
| Actual Chromium tab zoom | Verified 4x before and after the complete scenario, 320x256 CSS viewport in both themes and General; owned browser/profile retired |
| Existing native API/store proof | 157 groups retained after exact unchanged server/shared/package/test comparison; zero new native executions |

Focused command:

```text
node --test test/client/sticky-save-bar-clearance.test.js test/client/settings-save-state-view-contract.test.js test/client/settings-save-state-presentation.test.js test/client/settings-information-hierarchy-view-contract.test.js test/client/settings-connections-view-contract.test.js test/client/settings-connections-presentation.test.js
```

Final combined browser command, with the disposable test database pinned to IPv4 loopback:

```text
node --test --test-concurrency=1 test/browser/connections-layout-browser-verification.test.js test/browser/settings-save-state-browser-verification.test.js test/browser/settings-information-hierarchy-browser-verification.test.js test/browser/provider-authorization-status-browser-verification.test.js test/browser/provider-authorization-actions-browser-verification.test.js test/browser/connections-route-access.test.js test/compatibility/connections-layout-zoom.test.js
```

Each layout scene traverses native Tab and Shift+Tab without per-step corrective
scrolling, requiring the focused component's center to be visible and no overlap
with the save bar. Dirty draft values survive resize, controlled failure and text
enlargement. The read-only baseline recorded 7/10/12/39 center-obscured or
save-bar-overlapping forward targets at desktop/tablet/mobile/short-reflow sizes.
Final traversals had zero failures of those acceptance checks.

The walkthrough checked 1440x900, 800x900, 390x844 and 320x256, plus 640/641px width
and 600/601px height boundaries in both themes. At tablet width the normal bar
measured 58px with a 58px reservation; wrapped failure measured about 63.8px and
reserved 64px. Browser-local 64px feedback text enlarged the bar beyond half the
scrollport and correctly switched it to flow with zero reservation. This text
enlargement fixture is separate from actual native tab zoom.

Six walkthrough card captures and two final native-zoom captures were visually
reviewed. Actual settings/secret-status snapshots matched before/after. One
controlled settings PUT was fulfilled locally with current CSRF equality recorded
only as a boolean. No provider command or operator settings mutation was forwarded;
unexpected write and page-error counts were zero. Chromium was 156.0.8078.4.

Final source: 3,844 files, SHA-256
`5f6ee2c8e01683ba0a45964b2a671332e77e28a03ec0757b0a6fea70de4d3065`.
Ten changed code files, including both CSS files, were frozen before the final
complete gate, build, browser and walkthrough checks. No code changed afterward.

Private evidence is under `.tmp/connections-layout-2026-10-28/`. Preflight lint
corrected browser-global qualification and a shadowed fixture name. Visual review
invalidated the first zoom preflight: full navigation had reset zoom before its
scenario. The final fixture navigates first, then verifies zoom and CSS viewport
throughout. Earlier partial/failed evidence remains retained and is not counted
as final acceptance.

An additional whole-control viewport check found a 1.0–1.3 CSS-pixel textarea edge
clip behind existing bottom navigation at 320x256, including native 4x zoom.
A 4px scroll-margin experiment did not alter that observation and was removed.
Whole-control containment exceeds the minimum focus-visibility check; final
acceptance separately requires visible focus and zero save-bar overlap. The
navigation-edge finding remains for follow-up. These results do not establish
complete Focus Not Obscured Enhanced or whole-app reflow/WCAG conformance. Manual
screen-reader and physical-device checks remain deferred as requested. No live
provider, whole-application drainage or memory-minimum acceptance is implied.

GitHub MCP found zero open repository PRs initially and at the final check,
2026-10-28 15:39:24 UTC. Random local PR implementation and stale Dependabot
cleanup/rebasing were inapplicable. Work stays on main without a PR merge, new
branch, release or Git tag.

## Next item implemented

The label-association follow-up is implemented separately. See its
[research](CONNECTIONS_LABELS_RESEARCH_2026_10.md),
[design](CONNECTIONS_LABELS_DESIGN.md) and [outcome](CONNECTIONS_LABELS_OUTCOME.md).

The original finding was that built Spotify Client ID and Client secret fields
had no native label association, input ID, aria-label or aria-labelledby. The
follow-up implements unique matching for/id values and verifies names and label
activation while preserving write-only secrets and current commands. The
mobile-navigation edge finding and deferred manual AT/device acceptance remain
separate follow-up scope.
