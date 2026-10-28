# Storage labels and row outcome

October 28, 2026. See [official research, options and final stack](STORAGE_LABELS_RESEARCH_2026_10.md)
and [design](STORAGE_LABELS_DESIGN.md).

## Implemented result

Nine artwork controls now have native label links; four existing folder links
remain. Two small row components own the translation and per-user folder fields,
with required named string models and setup-time Vue useId values. Native form
groups and contextual Remove names identify each current row. Existing card/row
styles are reused, adding group legends without a new CSS owner.

The parent view uses a private WeakMap factory to assign symbolic render keys to
reactive row objects. Edits and preceding-row removal retain the surviving DOM
nodes and IDs. Equal or blank rows receive distinct identities. Row numbers serve
only as current display positions. No UI identity is attached to saved form data,
and the existing normalizers, save command and DTO contract remain unchanged.
The identity factory has no strong row registry, global singleton or timer; no
measured memory/RSS improvement is claimed.

Stable removal now retires the actual component. A scoped helper reuses the
existing command-focus tracker and captured native targets through nextTick,
moving an owned interaction to the next input, previous input or Add button.
An existing focus owner elsewhere is preserved. Explicit user movement, refused
removal and disconnected/hidden targets prevent inappropriate recovery. Temporary
listeners retire after mutation/render work, including controlled failure.

The parent data/save/quota methods and styles match the preceding commit after
accounting for the new component/key imports and two Add-button refs. Static
bindings, constraints and input types are unchanged. No server/shared/schema,
dependency, session/CSRF, filesystem or provider authority changes are introduced.
No schema refresh, migration or maintenance job is needed. All new JavaScript is
ESM, with two focused components and two narrow client helper files.

The final stack combines native labels/form groups, route IDs for static fields,
component useId values, weak view-owned keys, explicit named models and owned
removal focus. It avoids saved UI metadata and editable/index keys. Tradeoffs are
two component boundaries, visible row legends and a short focus-listener lifetime.
Research records alternatives and their pros/cons.

## Executed verification

| Boundary | Result |
| --- | --- |
| Focused identity/focus/form checks | 108 tests passed, zero failed, cancelled or skipped |
| Complete fast gate | 11,730 tests passed: server 6,453, client 4,574, scripts 703; zero failed, cancelled or skipped |
| Static/build checks | All 14 fast stages passed: Node baseline, copyright, migration/schema/anchor, ESM, image/topology, lint, test hygiene and build |
| Reviewed Storage/zoom preflight | Both entries passed; zero skips |
| Final combined browser command | All seven tests passed; zero failed, cancelled or skipped |
| Packaged UI | Eight viewport/theme scenes; 29 field associations/names, eight repeated groups, zero duplicate document IDs |
| Row identity | Edited fields and original DOM nodes/IDs survived preceding-row removal; duplicate blank additions had unique IDs |
| Removal focus | First/last/only-row pointer removals of both types reached visible next/previous/Add targets |
| Draft/save boundary | Clean initial state, conditional artwork fields, disclosure reopen and controlled failed save preserved drafts; canonical row keys and current CSRF verified |

Focused command:

```text
node --test test/client/settings-row-key.test.js test/client/settings-row-removal.test.js test/client/user-command-focus.test.js test/client/settings-form.test.js test/client/settings-form-fingerprint.test.js test/client/settings-media-storage-presentation.test.js test/client/settings-progressive-disclosure.test.js
```

The complete fast-stage chain ran through the private validate.mjs runner,
equivalent to the 14 validate:fast stages with server concurrency eight. Ten code
files were frozen before that gate and the final browser command. Source: 3,858
files, SHA-256 `6913da9f24773762be6c2e5b49e8fab6043c49c7d762ecaaf27f6858b03951bb`.
No code changed after that freeze.

Final browser command, with test PostgreSQL pinned to IPv4 loopback:

```text
node --test --test-reporter=tap --test-concurrency=1 test/browser/storage-labels-browser-verification.test.js test/browser/library-labels-browser-verification.test.js test/browser/connections-labels-browser-verification.test.js test/browser/connections-layout-browser-verification.test.js test/browser/settings-information-hierarchy-browser-verification.test.js test/browser/settings-save-state-browser-verification.test.js test/compatibility/storage-labels-zoom.test.js
```

Each Storage scene traverses native Tab and Shift+Tab through 55 controls, without
per-step corrective scrolling, requiring a visible focused center and no save-bar
overlap. A controlled programmatic preceding-row removal separately proves that
another surviving input keeps its existing focus; this is not a pointer-removal
claim. Pointer removal has its own positive destination/visibility assertions.
Unit checks cover reactive/frozen rows, independent owners, no serialized metadata,
primitive refusal, focus ownership loss, refused removal, hidden/retired targets
and render-failure listener cleanup.

The first identity preflight passed but recorded body focus after pointer removal.
Comparison with the original index-keyed view found a reused surviving button.
The reviewed implementation adds deliberate focus recovery for correctly retired
rows. Subsequent fixture failures corrected an assumption that initial Save is
disabled and an ambiguous global Add locator: the existing UI allows initial
saves, and its empty-list setup prompt provides a second Add action. The final
fixture checks the clean initial state and scopes Add to its region. Failed
candidates remain private evidence, not final acceptance. Contemporaneous
PostgreSQL diagnostics showed successful queries, accepting readiness and healthy
containers; these fixture failures did not establish a database outage.

## Local Docker result

The walkthrough at `http://127.0.0.1:47956` runs
`sha256:8b0e776cbc37beda428057d1226349382b6b85adf34d2dae54e69dfe3bac4f3a`,
replacing `sha256:c2d7db42989e04484646988daedd6eca3ea32e098058d208b894dba06b713782`.
The fresh pull/no-cache build succeeded and its temporary builder retired. The
existing administrator and all five mounts were preserved. The healthy read-only
Linux x64 service runs as UID 1000, with Node 24.22.1/npm 12.0.2. Startup verified
115 applied migrations, zero pending and zero new. Packaged readiness passed;
bootstrap and temporary password material were retired.

Exact comparison found unchanged 1,059 server and 13 shared files, 110 dependency
packages and 151 OS packages. All 157 client files match the local build; 56
compiled files differ. The unchanged native API/store proof retains 157 historical
groups, with zero fresh native executions. Entrypoint identity matched source and
its probe retired. The guarded data-bind readiness/publication probe passed and
removed its owned files.

The packaged UI passed desktop 1440x900, tablet 800x900, mobile 390x844 and short
320x256 reflow scenes in both themes. Six row captures were visually reviewed.
Actual settings/secret-status snapshots matched before/after, and the actual
settings GET retained no-store. Browser-only settings/paths/users were synthetic.
One settings PUT was fulfilled locally with 503, checking canonical four-row
arrays, edited values and current CSRF only as private comparisons/booleans.
No settings mutation or provider command was forwarded. Unexpected-write and
page-error counts were zero. Chromium was 156.0.8078.4.

Actual 4x Chromium tab zoom was verified before and after the complete Storage
scenario, with two 320x256 CSS-viewport theme scenes. Browser/profile retirement
was verified. Fresh final evidence is `native-zoom-PmpamX/` inside the evidence
root; both captures were visually reviewed. This is separate from viewport resizing.

Private evidence is under `.tmp/storage-labels-2026-10-28/`. Manual screen-reader
and physical-device acceptance remains deferred. The previous Connections
textarea/navigation edge clip remains separate. These checks do not establish
whole-app WCAG conformance, live-provider acceptance, memory minima or complete
application drainage.

## Next recommended item

GitHub MCP found zero open repository PRs initially and at the final check,
2026-10-28 19:27:11 UTC. Random local PR implementation and stale Dependabot
cleanup/rebasing were inapplicable. Work stays on main with no separate branch,
PR merge, Git tag or release. All sixteen changed files are included in this commit.

Completed by the [folder browser follow-up](FOLDER_BROWSER_OUTCOME.md): distinct
Browse names, native dialog focus lifecycle, confirmed read ownership and draft
preservation. Server filesystem authorization remains at its existing owner.
