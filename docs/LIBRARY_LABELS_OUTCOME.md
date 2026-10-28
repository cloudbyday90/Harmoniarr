# Library label outcome

October 28, 2026. See [official research, options and final stack](LIBRARY_LABELS_RESEARCH_2026_10.md)
and [design](LIBRARY_LABELS_DESIGN.md).

## Implemented result

The Library view now links all 24 formerly unassociated labels to their controls,
preserving five existing links and both wrapping checkbox labels. The running
baseline confirmed all 24 omissions. Operation runs and Outcome events reuse the
existing SettingsFormGroup component, whose fieldset/legend supplies distinct
context for the two Max age (days) fields. Existing retention wrappers remain;
the legends use the shared component's title and spacing styles.

One production view changes. Its script, styles, all input bindings, numeric
constraints and types match the preceding commit exactly. Defaults, reset actions,
help/warning copy, save ownership and server/session/CSRF authority retain their
existing owners. No new name attributes, runtime dependency, generic input owner,
schema refresh, migration or maintenance task is introduced. Support code is ESM.

The final stack is native labels/controls, unique route-owned IDs, the shared
native form-group component and modular browser checks. This adds useful native
names and activation without another runtime owner. Tradeoffs are maintaining ID
uniqueness if fields later become repeatable and the shared legend presentation
in retention. Research records the ARIA and generic-component alternatives.

## Executed verification

| Boundary | Result |
| --- | --- |
| Focused Settings checks | 41 tests passed, zero failed, cancelled or skipped |
| Complete fast gate | 11,720 tests passed: server 6,453, client 4,564, scripts 703; zero failed, cancelled or skipped |
| Static/build checks | All 14 fast stages passed, including Node baseline, copyright, migration/schema/anchor, ESM, image/topology, lint, test hygiene and build |
| New browser/zoom preflight | Both entries passed with no skips |
| Final combined browser command | All six tests passed; zero failed, cancelled or skipped |
| Packaged Library UI | Eight viewport/theme scenes passed; all 29 native associations/names, two named retention groups and document ID uniqueness verified |
| Draft/constraint behavior | Disabled/enabled cooldown, native lower-bound refusal, ranking-only reset and drafts across disclosure reopen passed |
| Native keyboard | Tab/Shift+Tab traversals passed without per-step corrective scrolling; focused centers visible with no save-bar overlap |

Six source-only label tests were replaced by the real browser checks; unrelated
Library constraints, bindings, defaults, save and warning checks remain. This
accounts for the six-test reduction from the preceding fast gate. Focused command:

```text
node --test test/client/settings-library-view-contract.test.js test/client/settings-information-hierarchy-view-contract.test.js test/client/settings-save-state-view-contract.test.js test/client/settings-save-state-presentation.test.js
```

The complete fast-stage chain ran through the private validate.mjs runner,
equivalent to the 14 validate:fast stages with server concurrency eight. Five code
files were frozen before that gate and final browser validation: the production
view, existing Library source-contract tests, ESM browser scenario, browser test
entry and explicit native-zoom entry. Source: 3,849 files, SHA-256
`cceeee2e300eca3728f7a74aab61bb3f712b7076acd531e232f7740748ede5dd`.

Final browser command, with test PostgreSQL pinned to IPv4 loopback:

```text
node --test --test-reporter=tap --test-concurrency=1 test/browser/library-labels-browser-verification.test.js test/browser/connections-labels-browser-verification.test.js test/browser/connections-layout-browser-verification.test.js test/browser/settings-information-hierarchy-browser-verification.test.js test/browser/settings-save-state-browser-verification.test.js test/compatibility/library-labels-zoom.test.js
```

Actual tab zoom was verified at 4x before and after the complete Library scenario,
with 320x256 CSS viewport in both themes. The owned browser/profile retired.
Fresh final evidence is `native-zoom-3Vi7Wq/` inside the evidence root; both captures
were visually reviewed. This is separate from resizing the browser viewport.

Private evidence is under `.tmp/library-labels-2026-10-28/`. No code changed after
the final freeze. Automated DOM/name/pointer checks do not establish spoken
announcements or complete WCAG conformance. Screen-reader and physical-device
acceptance remain deferred by the user. The previous Connections textarea/mobile
navigation edge clip remains separate follow-up scope; no fix is claimed here.

## Local Docker result

The walkthrough at `http://127.0.0.1:47956` runs
`sha256:c2d7db42989e04484646988daedd6eca3ea32e098058d208b894dba06b713782`,
replacing `sha256:84c916535e7c85fd0e45079185c5fff83bc8d9b13589dd08f92ddc0dbc3d519a`.
The fresh pull/no-cache build succeeded and its temporary builder was removed.
The healthy read-only Linux x64 service runs as UID 1000, with Node 24.22.1/npm
12.0.2. The existing administrator and all five mounts were preserved. Startup
verified 115 applied migrations, zero pending and zero new. Packaged readiness
passed, bootstrap retired and temporary password material was removed.

Exact comparison found unchanged 1,059 server files, 13 shared files, 110 dependency
packages and 151 OS packages. All 157 client files match the local build; 56
compiled files differ from the preceding image. The unchanged native API/store
proof retains 157 historical groups, with zero fresh native executions. Entrypoint
identity matched source and its probe retired; the guarded data-bind readiness/
publication check passed and removed its owned files.

The packaged UI passed desktop 1440x900, tablet 800x900, mobile 390x844 and short
320x256 reflow scenes in both themes. Six retention captures were visually
reviewed. Actual settings/secret-status snapshots matched before/after, and the
actual settings GET retained no-store. One normal settings read was observed;
the fixture guard admitted only reads, with zero unexpected writes and
zero page errors. No settings mutation, cleanup or provider command was forwarded.
Chromium was 156.0.8078.4. These checks do not qualify live providers or whole-app
memory/drainage behavior.

## Next recommended item

GitHub MCP found zero open repository PRs initially and at the final check,
2026-10-28 18:44:00 UTC. Random local PR implementation and stale Dependabot
cleanup/rebasing were inapplicable. Work stays on main with no new branch, PR
merge, Git tag or release. All eleven changed files are included in this commit.

The Storage follow-up is implemented separately; see its
[research](STORAGE_LABELS_RESEARCH_2026_10.md), [design](STORAGE_LABELS_DESIGN.md)
and [outcome](STORAGE_LABELS_OUTCOME.md). The original recommendation was to
associate Storage field labels, including repeatable path-translation and
per-user folder rows. At that baseline, the configured built Media & storage DOM had 11
unassociated labels, including two translation fields and artwork controls.
The read-only inventory forwarded no mutation and had zero blocked writes; it
includes controls inside closed disclosures. Additional per-user rows must be
covered when present. Verify stable unique row identities through add/remove,
native label activation and scoped drafts without granting filesystem or provider
authority. A repeatable field component should own its IDs at setup.
