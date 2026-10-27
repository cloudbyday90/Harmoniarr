# Automatic schema maintenance outcome

October 27, 2026. Routine schema diagnostics now run automatically through the
existing application maintenance supervisor. The former manual control requested
read-only inspection; it did not apply migrations or repair schema objects.

## Delivered behavior

The modular ESM maintenance owner checks immediately at startup and uses an
hourly due interval for current/attention results. Paused, busy or failed attempts
use a five-minute retry interval. Due times are anchored to the attempt start;
timer execution is best effort under load. Attempts never overlap or queue.
Recovery/restore/upgrade maintenance admission is checked inside the existing
bounded read-only observer transaction, alongside preparation fencing.

The owner retains one detached safe summary in memory. Restart begins pending;
overdue completed results become stale. The administrator endpoint reads this
summary without starting or cancelling a scan. Current administrator checks,
rate limits, no-store and fixed failure output remain in place. Maintenance owns
cancellation and waits for actual native drainage; uncertain retirement seals
further admission and refuses a successful shutdown.

Opening diagnostics automatically loads the latest maintenance summary. The
manual schema button is removed. Pending/running results have bounded five-second
followup reads within the existing 25-second loading lifetime; other states stop
polling. Closing the section cancels only the view's read. Loading preserves
focus and uses a persistent polite status region outside the busy results.

Known versioned migrations already run through guarded Docker startup preparation
before HTTP. This change adds no migration, table or repair path. Unexpected drift
requires review; diagnostic history cannot authorize startup or mutations.

## Qualification

The final frozen source contains 3,716 files with source fingerprint
`a824551ebbd991ba34f1bdf1b7bd59d23d70c86be591a9c53db1b52e0920610b`.
All 19 changed code/test files were frozen before final qualification.

- The 14-stage fast gate passed: 6,247 server, 4,504 client and 703 script tests
  (11,454 total), with zero failures, skips or cancellations. Lint, ESM,
  copyright, migration/snapshot/anchor checks, Compose policy, hygiene and the
  production client build passed. npm audit reported zero vulnerabilities.
- The packaged PostgreSQL maintenance/HTTP fixture proved automatic startup,
  164 current anchors, current-admin refusal, no HTTP-triggered inspection,
  missing-index observation without repair, preparation contention, actual
  recovery-lock pause/retry, bounded maintenance-lock SQL admission, stale
  reporting, no-store, quotas and shutdown cancellation with true drainage.
  At most one scan ran; ledger/catalog/function fingerprints were preserved.
- The existing packaged drift fixture passed all 16 scenarios, including
  read-only refusal, real lock timeout, saturated-pool independence, cancellation,
  deadlines and native backend/lock retirement. Both restricted fixture
  containers exited successfully, were removed and had absence verified.
- The browser test passed its automatic loading, bounded followup, no ongoing
  polling, focus, polite status, deadline, safe lifecycle/error, reopen and
  desktop-light/mobile-dark checks. The live Docker existing-admin browser check
  loaded current/164/no-store with one request, retained focus and fit mobile
  width. Desktop/mobile and dark fixture screenshots were visually inspected.

The fresh packaged image, mount preservation and cleanup evidence are recorded
in the separate [Docker outcome](LOCAL_DOCKER_AUTO_SCHEMA_MAINTENANCE_OUTCOME.md).
Private logs and receipts are under `.tmp/schema-maintenance-2026-10-27/`.
Manual screen-reader and physical-device acceptance remain deferred; automated
status/focus checks are not a claim of full WCAG conformance.

## Recommendation and remaining work

Adopt guarded startup migration preparation, automatic bounded maintenance
observation, cached administrator status, and reviewed repair as separate
ownership boundaries. This removes routine operator work and avoids redundant
page-driven scans; the cost is a historical, process-local result and best-effort
scheduling. The [research](AUTO_SCHEMA_MAINTENANCE_RESEARCH.md) compares alternatives
and cites official PostgreSQL/W3C sources; the [design](AUTO_SCHEMA_MAINTENANCE_DESIGN.md)
details the ownership contracts.

GitHub MCP found no open repository or Dependabot PRs at the final check. Random
local application and stale cleanup/rebase were therefore inapplicable. No PR
merge, branch, release or tag is part of this change.

Next: return to root login's verified credential epoch and required audit sharing
the issuance transaction owner. That security task was postponed for this schema
workflow change and is not claimed as implemented here.
