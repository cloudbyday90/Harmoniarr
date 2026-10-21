# Metadata history manual fixture design

Decision: October 21, 2026. Prepare a repeatable desktop assistive-technology
session using the actual built application, authenticated routes and shared
history components. A passing fixture qualification establishes that the session
can be exercised; the operator must still record speech and usability results.

## Problem and selected boundary

The [manual acceptance procedure](METADATA_HISTORY_MANUAL_ACCESSIBILITY.md)
requires three history pages, a genuinely pending read and a recoverable error.
The preserved walkthrough might not contain these conditions. Creating real
provider work to obtain history would add cost and unrelated state changes.

`npm run manual:metadata-history` builds the client and starts a loopback HTTP
session with a fresh, non-reused PostgreSQL Docker container and disposable database.
It never borrows the shell's PostgreSQL connection. The operator opens an ordinary
private browser window, creates a disposable account through the real bootstrap
flow, then follows the printed artist URL. This supports an operator's installed
browser/AT pairing without requiring a Playwright-controlled personal profile.

The catalog and history are synthetic. Pages contain 10 initial, 10 continuing
and one final event, with distinct identifiers. Cursor reads replay the same
page, including after failure. The production history component, focus owner,
status region, shell CSS, HTTP session and CSRF implementation remain real.
Synthetic onboarding/overview summaries avoid unrelated health probes; they are
fixture data and do not establish provider health.

## Modular ownership

| Owner | Responsibility |
| --- | --- |
| `testing/browser/metadata-history-data.js` | Shared deterministic history values; no app imports |
| `testing/manual/metadata-history-controller.js` | Cursor responses, one held read, one-shot failure, reset and drain |
| `testing/manual/metadata-history-http-guard.js` | Fixture route/Host/Origin restrictions before app dispatch |
| `testing/manual/metadata-history-session.js` | Actual app composition and existing integration resource lifetime |
| `testing/manual/manual-postgres-runtime.js` | Fresh random-password PostgreSQL, local Docker, explicit loopback publishing and exact container retirement |
| `scripts/run-manual-metadata-history.js` | Terminal commands and cooperative quit/EOF/signals |

Control happens through terminal commands, with no HTTP fault-control endpoints.
`hold` arms the next read; `release` resolves the actual hold; `fail` rejects a
held read or the next read once. A reset while held is refused. `reset` clears
faults/counts; the operator reloads the page to restore initial UI state.
`status` reports bounded fixture state rather than account/history content.

Quit, EOF and handled signals settle/drain a held controller operation before
the existing HTTP, worker, database and container teardown. The first body or
cleanup failure, including `null`, remains the reported failure. The existing
integration harness's residual worker drain remains; this is not a claim of
complete application quiescence or a general test-suite speed improvement.

## Security and deployment scope

The actual server binds to `127.0.0.1` on an owned ephemeral port. Before its
origin is bound, requests are refused. Host must match that origin exactly;
foreign Origin and cross-site/same-site Fetch Metadata are refused. The explicit
allowlist admits only required static/UI/history/session reads and bootstrap,
login, refresh and logout POSTs. Provider search GETs, domain mutations, unknown
routes, unsupported methods and HTTP control attempts are refused before the
underlying app dispatches them. Allowed auth/history endpoints keep real server
checks. The guard is fixture containment, not proof of production authorization.

The CLI accepts no deployment target or provider parameters. It uses no real
library/download mounts and starts no production scheduler. The catalog command
ledger must remain empty. Test tooling is outside `src`; it is not packaged by
the runtime Dockerfile. There is no application endpoint, migration, dependency,
release or version change.

The interactive database uses an explicit `127.0.0.1::5432` Docker port mapping,
a random per-run password, a two-CPU/512-MiB container
limit and no host bind mounts. Actual published bindings are inspected before
the app starts. A local Docker Engine 28+ endpoint is required because older
versions have documented localhost publishing limitations. Existing general-purpose
Testcontainers defaults are not assumed to provide loopback containment. The
existing integration database interface delegates stop to removal of the exact
named/labeled container and its disposable volumes, then verifies absence.
Other test suites keep their existing policy. Hard process termination can
leave owned resources; inspect exact identity before recovery/removal.

This desktop fixture is intentionally inaccessible to another physical device.
Use a separately owned device environment for physical safe-area and keyboard
acceptance. Do not silently expose this test server to the LAN or infer that
desktop WebKit, injected spacing or an emulated device proves Safari/hardware.

## Validation and next handoff

Pure controller tests prove page replay, held admission, retry and retirement.
Native HTTP guard tests prove refusal before downstream dispatch. The explicit
`npm run validate:metadata-history-manual-fixture` lane uses a real database and
Chromium to exercise bootstrap, loading, continuing, failure, retry, final focus,
and teardown while a read is held. It stays outside default browser/fast globs;
the lightweight controller/guard tests join the existing server unit gate.

Research/tradeoffs are in the [research document](METADATA_HISTORY_MANUAL_FIXTURE_RESEARCH_2026_10.md).
Executed results and unperformed operator checks belong in the
[outcome](METADATA_HISTORY_MANUAL_FIXTURE_OUTCOME.md).
