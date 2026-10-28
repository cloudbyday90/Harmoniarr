# Connections label outcome

October 28, 2026. See [official research, options and recommendation stack](CONNECTIONS_LABELS_RESEARCH_2026_10.md)
and [design](CONNECTIONS_LABELS_DESIGN.md).

## Implemented result

Ten formerly unassociated visible labels now reference their native controls with
unique route-prefixed IDs. The running baseline reproduced all ten missing native
associations across Connection behavior, Spotify, YouTube and Fanart.tv. Six
existing Soulseek/Apple associations and the collection-check association remain.
The form continues to use native wrapping labels for checkboxes and radios.

Only SettingsConnectionsView production markup changes: twenty attributes, with
no new runtime owner, component abstraction or dependency. The existing form
draft, JSON save, password/autocomplete and disabled bindings retain ownership.
No name attribute, API, command, server/session/CSRF, schema or maintenance change
is introduced. This task's JavaScript support files use ESM.

The recommended stack is native semantic controls and labels, route-owned unique
IDs, and a focused modular browser scenario. Benefits are useful accessible names
and native label activation with no extra runtime. The tradeoff is maintaining
route ID uniqueness; repeated future components should own Vue useId at setup.

## Executed verification

| Boundary | Final executed result |
| --- | --- |
| Focused Settings checks | 63 tests passed in eight suites; zero failed, cancelled or skipped |
| Complete fast gate | 11,726 tests passed: server 6,453, client 4,570, scripts 703; zero failed, cancelled or skipped |
| Static/build checks | Node baseline, copyright, migration/schema/anchor, ESM, image/topology, lint, test hygiene and production build passed |
| Combined browser/compatibility command | All ten tests passed, zero failed, cancelled or skipped |
| Label behavior | All 17 explicit field associations, native names and label activation at three viewport sizes in both themes; zero duplicate document IDs |
| Secret/draft behavior | All seven secret controls start blank, retain password/autocomplete behavior, disable on remove, retain synthetic drafts after re-enable and disclosure reopen |
| Existing layout and focus | 19 viewport/theme/feedback/shared-consumer scenes passed native Tab and Shift+Tab without per-step scroll correction |
| Actual Chromium tab zoom | 4x verified before/after, three 320x256 CSS-viewport scenes passed, browser/profile retired |

The complete final fast-stage chain ran via the private `validate-final.mjs`
runner, equivalent to the 14 `validate:fast` stages with server concurrency eight.
The stable final production and fixture source was frozen before that gate and
the final browser command. Source: 3,846 files, SHA-256
`0eeafefdca8438e45db8b762cf395551698848b82388da22437defb465b2aebd`.
Three code files changed: one production view, one ESM browser scenario and its
test entry. No code changed afterward. Exact comparison confirmed the production
view differs only by the twenty association attributes; script, styles, bindings
and visible copy match the preceding commit.

Focused command:

```text
node --test test/client/settings-connections-view-contract.test.js test/client/settings-connections-presentation.test.js test/client/settings-save-state-view-contract.test.js test/client/settings-save-state-presentation.test.js
```

Final browser command, with test PostgreSQL pinned to IPv4 loopback:

```text
node --test --test-concurrency=1 test/browser/connections-labels-browser-verification.test.js test/browser/connections-layout-browser-verification.test.js test/browser/settings-save-state-browser-verification.test.js test/browser/settings-information-hierarchy-browser-verification.test.js test/browser/provider-authorization-status-browser-verification.test.js test/browser/provider-authorization-actions-browser-verification.test.js test/browser/connections-route-access.test.js test/compatibility/connections-layout-zoom.test.js
```

The zoom fixture's fresh final evidence is
`.tmp/connections-layout-2026-10-28/native-zoom-Oi7Fua/`; its two captures were
visually reviewed. This is actual tab zoom, separate from viewport sizing.

The first browser preflight reached the disabled-secret check after its six
viewport/theme scenes, then failed because Playwright Locator.click retargets a
label to its disabled input and waits for enabled state. A separate minimal native
control confirmed that fixture behavior. The repaired fixture uses an actual
pointer click after verifying the label's hit target, then requires the disabled
control to remain unfocused. This failed candidate is retained, not acceptance.
The contemporaneous PostgreSQL diagnostic reported a successful independent
query, accepting readiness and a healthy running container; it was not evidence
of a database outage.

A subsequent candidate completed the interaction checks but failed a fixture
assertion expecting one settings GET. Source tracing confirmed two existing
owners: the Connections draft loader and setup-progress reader. The final fixture
requires both reads. The packaged application was unchanged by either fixture
correction, and the corrected walkthrough scenario passed with settings preserved.

Private evidence: `.tmp/connections-labels-2026-10-28/`.

## Local Docker result

The local walkthrough at `http://127.0.0.1:47956` now runs image
`sha256:84c916535e7c85fd0e45079185c5fff83bc8d9b13589dd08f92ddc0dbc3d519a`,
replacing `sha256:13615b07f81739b71e4e5325cff86642e1e02d07298dcdc3268ec51c58b93dc1`.
The fresh pull/no-cache build succeeded, with its temporary builder retired.
The existing administrator and all five bind mounts were preserved. The service
is healthy and read-only, running Linux x64 as UID 1000 with Node 24.22.1/npm
12.0.2. Startup verified 115 applied migrations, zero pending and zero new.
Packaged readiness passed; bootstrap and temporary password material were retired.

Exact comparison found unchanged 1,059 server and 13 shared files, 110 dependency
packages and 151 OS packages. All 157 client files match the local production
build; 56 compiled files differ from the preceding image. The unchanged native
API/store proof retains 157 historical groups with zero fresh native executions.
Entrypoint identity matched source and its probe retired. The guarded data-bind
readiness/publication probe passed and its owned files were removed.

The corrected walkthrough passed six viewport/theme label scenes plus disclosure
reopen and all seven secret-field controls. Its six screenshots were visually
reviewed. Actual settings and secret-status snapshots matched before/after;
the actual settings GET retained no-store. Browser-local saved-secret flags were
synthetic. No settings/provider mutation was forwarded, and unexpected-write and
page-error counts were zero. Chromium was 156.0.8078.4. This walkthrough did not
change live credentials or qualify provider access.

## Remaining scope and next item

GitHub MCP found zero open repository PRs initially and at the final check,
2026-10-28 18:27:06 UTC. A random local PR implementation and stale Dependabot
cleanup/rebasing were inapplicable. Work stays on main with no separate branch,
PR merge, Git tag or release. All nine changed files are included in this commit.

The Library follow-up is implemented separately; see its
[research](LIBRARY_LABELS_RESEARCH_2026_10.md), [design](LIBRARY_LABELS_DESIGN.md)
and [outcome](LIBRARY_LABELS_OUTCOME.md). The original recommendation was to
associate Library settings labels with their controls, starting with source
safety cooldown, history retention and match-ranking fields. Source inspection in
SettingsLibraryView and the built Library DOM found 24 sibling field labels
without native associations, including these controls and naming templates.
The read-only follow-up check forwarded no mutation and recorded zero blocked
writes. This inventory includes fields inside disclosures; it is not a complete
Library accessibility assessment.
Preserve the existing numeric constraints, draft/save boundary and disabled-state
policy, and verify names and label activation in the built UI.

The previous approximately 1.0–1.3 CSS-pixel textarea edge clip behind mobile
navigation at 320x256 remains a separate follow-up. Manual screen-reader and
physical-device acceptance remain deferred as requested. Automated accessible-name,
DOM and pointer checks do not establish spoken announcements, every browser or
whole-application WCAG conformance. No live provider qualification is claimed.
