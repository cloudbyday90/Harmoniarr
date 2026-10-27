# Pool and session admission outcome

October 27, 2026. Ordinary checkouts now have a finite native default and pending
cap. Fresh session SELECTs have independent SQL and owner limits, cancellation,
safe refusal and verified resource ownership. The implementation uses modular ESM
services/store adapters; session writes retain their existing transaction owners.

## Validation

- Final fast gate: 6,230 server, 4,503 client and 703 script tests passed, with
  zero failed/skipped/cancelled tests. Static checks, lint, ESM, migration/snapshot/
  contract checks, Compose policy, hygiene and build passed. npm audit found no
  advisories. Focused pool/session/protocol checks also passed.
- Seven packaged PostgreSQL entries passed on the immutable image: 10 pool/session
  scenarios, administrator schema HTTP, 16 schema drift/lifecycle cases, ordinary
  observation/backup, six preparation serialization cases, 17 snapshot transaction
  cases and 12 migration CLI reader cases. Each guarded container exited and its
  exact removal was verified.
- The new session scenarios observe promise/callback/query queue bounds and native
  expiry, safe HTTP 503 followed by retry, real table-lock timeout with rollback
  and setting restoration, actual HTTP disconnect/backend retirement, current
  role and revocation refusal, active query cancellation/deadline and cold startup
  failure. No result is authorized after timeout; no cached role is used.
- Three real Chromium diagnostic scenarios passed, retaining explicit refresh,
  no-store, status/focus, timeout and retry behavior. The client API 503 regression
  confirms that temporary session unavailability does not invoke auth reset.
  The existing administrator's live current-result desktop/mobile screenshots
  were reviewed; readiness and CLI checks passed with 115 applied migrations and
  164 current anchors. All five mounts and existing administrator/data were kept.
- All six selected slskd native lanes passed; see the
  [separate outcome](SLSKD_0262_QUALIFICATION_OUTCOME.md).

Windows host integration: six of seven auth/CSRF cases passed. The backup-export
case failed with `EPERM: operation not permitted, fsync`; a targeted diagnostic
confirmed that exact HTTP failure. This cohort is not claimed fully passing.
Owning backup/directory-sync production code is unchanged, and the earlier
[directory-sync scope](BACKUP_DIRECTORY_SYNC_OUTCOME.md) does not establish native
Windows support. Actual backup/restore passed in the packaged Linux observation
lane, along with the existing data-bind durability probe. No durability check
was weakened to obtain a passing host result.

Final source: 3,700 files, SHA-256
`fea8d22af08874f3bbaa5fed9212c875f95235672335d5582960709b498246c6`.
All 35 changed code/test files are frozen and checked after qualification. The
image/database/browser candidate was captured before the fixture-only slskd
repairs; exact comparison confirms all production files and affected database/
browser tests are unchanged. Those successful lanes were retained, not rerun
after unrelated fixture changes. The final fast gate and affected provider lanes
were executed again on the reviewed fixture source.

The expanded native preflight initially asserted that the pool must be empty
after cancellation. A concurrent readiness consumer can legitimately create a
replacement. The corrected fixture verifies the cancelled backend's absence,
distinct replacement identity and unchanged pool maximum instead of inferring
retirement from aggregate pool count. No production timeout was increased.

## PR work and next item

GitHub MCP found only [PR #57](https://github.com/cloudbyday90/Harmoniarr/pull/57),
created October 27 and mergeable. Random selection from the one-member eligible
set selects that PR. No stale Dependabot branch needed rebasing. Its local
implementation includes exact provider-wire support, not only a Compose tag;
see [separate design](SLSKD_0262_QUALIFICATION_DESIGN.md) and
[outcome](SLSKD_0262_QUALIFICATION_OUTCOME.md). The tested local implementation
supersedes that PR when published on main. No PR merge, branch, release or tag is used.

Next: bound and transactionally own rotated-token replay family revocation/audit.
The session SELECT deadline deliberately does not abandon these security writes.
Keep fresh authority checks, idempotent family handling and unknown-commit
outcomes explicit. Manual screen-reader/device acceptance remains deferred.

See [research](POOL_SESSION_ADMISSION_RESEARCH.md),
[design](POOL_SESSION_ADMISSION_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_POOL_SESSION_ADMISSION_OUTCOME.md).
