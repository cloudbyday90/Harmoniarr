# Metadata history manual fixture outcome

Completed October 21, 2026: a repeatable desktop manual-test environment and its
automated qualification. The operator chose “Prepare fixture; manual checks
later.” Actual screen-reader speech, physical-device safe areas and on-screen
keyboard acceptance remain unperformed.

## Delivered behavior

`npm run manual:metadata-history` builds the real client and prints a local
bootstrap URL and synthetic artist URL. The operator creates a disposable test
account in a private window of their installed browser. The fixture provides
10 initial, 10 continuing and one final event, terminal hold/release/failure
controls and a reset/reload path. Retry keeps the same cursor.

The session uses real app/session/history routes and production components with
synthetic catalog and health-summary owners. An outer server guard refuses
provider-backed GETs, domain mutations, unknown paths, foreign Host/Origin and
cross-site/same-site Fetch Metadata before app dispatch. Terminal controls are
not HTTP endpoints. Auth/history endpoints retain their underlying checks.

The database is a new Docker container with explicit loopback publishing, a
random per-run password, no host bind mounts and two-CPU/512-MiB/128-PID limits.
Local Docker Engine 28+ is required. The adapter inspects actual binding and
exact identity, waits for native health, then reuses the existing isolated
database/app lifetime. Held controller work drains before HTTP shutdown; the
actual container and volumes retire through exact name/label/ID ownership.

All first-party JavaScript is ESM, with small controller, HTTP-guard, database,
session and CLI files. The shared history data module keeps the existing
compatibility fixture's values intact. No production route, migration, runtime
component, dependency version, application version or release was added.

## Executed evidence

Frozen candidate: 3,219 non-Markdown source files, SHA-256
`81a338ad86085af514d1a22f42a6d291063ea81e445ba2f990b70435e29c4b7a`;
11 changed/new code or configuration files. Private raw evidence is under
`.tmp/metadata-history-manual-2026-10-21/`.

| Selection | Result and supported claim |
| --- | --- |
| Focused controller and native HTTP guard | 7/7 pass: replay, held/competing reads, one-shot failure/retry, retirement, invalid input and pre-dispatch refusal |
| Explicit real app/PostgreSQL/Chromium fixture lane | 1/1 pass: bootstrap, continuing, held focus, failure/retry, final focus, real server refusal, actual database limits/binding and held-read teardown; endpoint closed and exact container absent afterward |
| Existing explicit compatibility consumers | 16/16 pass across Chromium 156.0.8078.4, Firefox 157.0 and WebKit 27.2, including actual Chromium 400% tab zoom; this checks the extracted shared data's consumers |
| Actual CLI child-process controls | Quit and EOF both exit successfully after native readiness; each owned container is absent afterward; deployment-target arguments are refused |
| Complete `validate:fast` | 10,758/10,758 pass: 5,605 server, 4,456 client, 697 scripts; static policy, lint, hygiene and builds pass; 225 existing Vue warnings remain |
| Updated skills | Standards and testing skills pass the bundled skill validator; manual reference is linked from the standards entrypoint |

The browser build's 155 artifacts match the subsequent complete fast build.
There were no skipped/cancelled tests or relaxed deadlines/workers/assertions.
The large full PostgreSQL suite was not rerun for test-only composition/data
changes; the new real database lane was executed. This is not a whole-suite
performance comparison. Only seven lightweight checks join the default unit
gate; manual/database/browser qualification remains explicit.

Actual OS-signal delivery was not independently qualified on this Windows host;
quit and EOF were. This outcome does not certify hard-kill cleanup or invisible
worker completion. The existing fixture residual drain remains.

## Retained failed candidate and correction

Initial qualification before the additional database containment passed. Lint
caught a duplicate data import/re-export, which was corrected before final
qualification. The first bridge-default containment candidate then failed its
strict assertion because Docker exposed two database bindings rather than the
required single loopback binding. It refused before app creation; its container
and labeled network were removed. That failure remains in
`manual-loopback-candidate.log`; the actual cause of the default-binding behavior
was not established by later passing controls.

The final adapter uses Docker's explicit `127.0.0.1::5432` mapping. Its owning
test and the final frozen-source test both passed without weakening the binding
invariant. Earlier and final logs remain separate.

## Publication and next acceptance

MCP GitHub searches at the start and final review returned zero open PRs. No PR
could be selected, rebased, closed or implemented this round. Work remains on
main; no release, tag or version bump is part of this change.

The [research document](METADATA_HISTORY_MANUAL_FIXTURE_RESEARCH_2026_10.md)
records W3C/WAI, OWASP, IETF, Docker and Playwright recommendations, alternatives
and the selected stack. The [design](METADATA_HISTORY_MANUAL_FIXTURE_DESIGN.md)
records the implementation boundaries. The preserved no-cache Docker result is
recorded separately in the [rebuild outcome](LOCAL_DOCKER_METADATA_HISTORY_MANUAL_OUTCOME.md).

Next: run the [prepared manual procedure](METADATA_HISTORY_MANUAL_ACCESSIBILITY.md)
with an available screen-reader operator and their installed browser. Record
actual announcements, reading order, keyboard/focus and retry results with exact
versions. Then perform nonzero safe-area and on-screen-keyboard acceptance on a
real device in its separately owned environment. This loopback fixture supplies
no phone access or physical-device evidence, and no WCAG conformance claim.
