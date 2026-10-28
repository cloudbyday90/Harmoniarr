# Storage folder browser outcome

October 28, 2026. See [research, pros/cons and final stack](FOLDER_BROWSER_RESEARCH_2026_10.md)
and [design](FOLDER_BROWSER_DESIGN.md).

## Implemented result

The four Browse buttons have destination-specific accessible names. The native
dialog is named by its visible heading, starts focus on Close and closes before
parent unmount so the browser returns focus to the correct invoker. Cancel,
Close, Escape, backdrop and confirmed Select share an idempotent exit. Native
modal behavior supplies containment; no custom focus trap was added.

A scoped ESM composable now owns requested/confirmed directory state, transport
cancellation and current-request publication. A new read immediately revokes
selection; failed, malformed, superseded or retired reads cannot select a path.
An initial failure no longer makes the default root selectable. Retry is explicit
and errors use fixed public text. Directory buttons replace unsupported listbox
roles. Navigation places owned focus on the persistent path before replacing
controls; late completion does not move focus. The old double-click request
handler is removed. Scoped token-based styles keep the dialog within the viewport.

Only the captured draft field changes on Select. Other drafts survive and the
existing explicit save remains required. The parent clears its target callback
on close. The system API forwards an optional AbortSignal through the shared
client. No server/shared/schema, dependency, filesystem permission or session/CSRF
contract changes were made. No schema refresh or maintenance job is needed.
The final stack and its tradeoffs are recorded in the research document.

## Executed verification

| Boundary | Result |
| --- | --- |
| Focused read/API tests | 22 passed; current/latest success, explicit root, retry, malformed data, stale success/rejection and scope retirement with ignored abort |
| Complete fast gate | 11,744 passed: server 6,453, client 4,588, scripts 703; zero failed, cancelled or skipped |
| Static/build | All 14 stages passed: Node, copyright, migration/schema/anchor, ESM, image/topology, lint, hygiene, test groups and build |
| Reviewed browser preflight | Both folder-browser/reflow and actual-zoom entries passed, zero skips |
| Final browser command | 13 passed, zero failed, cancelled or skipped; new dialog, existing Storage row/zoom and deployment authority regressions |
| Packaged dialog | 32 destination/viewport/theme scenes, keyboard and pointer entry, native focus return, list-button navigation, no horizontal overflow and reachable footer controls |
| Read failures and dismissal | Held initial read refuses selection; close/reopen fences the prior target; failure/malformed Retry recover; four non-selection exit paths preserve drafts |
| Actual tab zoom | Chromium reports 3.9999999999999996 (4 within floating-point tolerance), 320x256 CSS viewport, eight destination/theme scenes and retired owned browser/profile |
| Actual settings | Existing administrator login, no-store GET and equal parsed settings/secret-status before/after; zero forwarded mutations or page errors |

The complete gate used the private validate.mjs runner, equivalent to the 14
validate:fast stages with server concurrency eight. Nine code files were frozen
before the gate and final browser command. Source: 3,863 files, SHA-256
`a2b2e92ec56367bd458287dd01ce072b5c9626eef8ee585355307dacfffee35e`.
The first browser preflight exposed a fixture that reused a previously selected
empty folder between viewport scenes; each scene now sets fresh synthetic drafts.
The initial fixture lint errors were corrected before freezing. Failed evidence
is retained separately; final results above are from the corrected candidate.
Six packaged desktop/mobile/reflow captures and two final native-zoom captures
were visually inspected in both themes; title, status, focus indicator and footer
actions remained visible.

```text
node --test test/client/use-folder-browser.test.js test/client/system-api.test.js
node --test --test-reporter=tap test/browser/folder-browser-verification.test.js test/browser/settings-authority-route-access.test.js test/browser/storage-labels-browser-verification.test.js test/compatibility/folder-browser-zoom.test.js test/compatibility/storage-labels-zoom.test.js
```

Private evidence is in `.tmp/folder-browser-2026-10-28/`: source/code freezes,
per-stage logs, browser records/captures, runtime inventories, cleanup receipts
and final manifest. It is ignored, avoiding committed credentials or host paths.
The browser fixture intercepts filesystem GETs with synthetic data and guards
every mutation. These results do not claim native filesystem load performance,
screen-reader speech, physical-device acceptance or full WCAG conformance.
Real screen-reader and physical-device checks remain deferred as requested.

## Local packaged outcome

The fresh disposable builder used `--pull --no-cache --load` and was removed.
The current walkthrough is healthy at http://127.0.0.1:47956 on image
`sha256:9c9e868f5467f37a5dd84e5e77fb23ba79188e8c5a9947320381197c0321c9df`.
It preserves the existing administrator and five bind mounts, loopback-only port,
read-only root and Linux x64 UID 1000 runtime (Node 24.22.1/npm 12.0.2). Startup
verified 115 applied migrations, zero pending and zero newly applied. Bootstrap
retired, readiness passed and the temporary password file was removed.

The 1,059 server and 13 shared files, 110 dependency packages, 151 OS packages,
Node binary and root metadata match the preceding image. All 157 compiled client
files match the local build; 56 differ from the preceding image. Entrypoint bytes
and executable mode match source; the owned backup/data-bind publication probe
passed and removed its files. Both disposable inspection containers retired.
Native source/tests and packaged runtime comparison support retention of 157
historical native qualification groups; **zero fresh native groups** are claimed.

## PR check and next item

GitHub MCP found no open repository PRs initially and on final review October 28,
2026. Random local PR implementation and stale Dependabot cleanup/rebasing were
inapplicable. All fifteen changed files are included, directly on main. No branch,
release, tag or PR merge was created.

Next: bound server directory enumeration and the rendered folder list, with
explicit continuation/search for large directories. The current admin endpoint
still materializes and sorts a full directory and the client renders all entries.
Any follow-up must preserve administrator authority, distinguish complete from
partial results and keep selection tied to a successfully confirmed directory.
Do not silently truncate, add an external service or infer a memory improvement
from this lifecycle fix; actual allocation/RSS qualification belongs to that task.
