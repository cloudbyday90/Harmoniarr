# Recovery operator lifecycle outcome

Validated October 21, 2026 on main with Node 24.22.0/npm 12.0.2 and disposable
native PostgreSQL fixtures. The baseline reproduced two armed rows from
concurrent arms; blocked/failed force replacement cancelled old material; and
failed cancellation auditing left cancellation committed. No arbitrary remote
exploitability is inferred from those local reproductions.

## Implemented result

The new ESM operator service owns arm/force-rearm/cancel through the existing
transaction runner. The parent recovery service now composes operator and
completion owners. The recovery store propagates the explicit queryable through
operator reads/writes and owns the transaction advisory-lock SQL.

Maintenance guarding precedes lifecycle advisory ownership and run-row locking.
This protects both empty admission and existing-run decisions. Fresh database
time after waits owns expiry and the new recovery window. A blocked replacement
leaves valid existing material intact; rolled-back replacement/cancellation and
audit failures preserve their original Error/null. Force disarming remains
allowed under maintenance. Completion retains original-run ownership and its
account/session/run/audit transaction.

The additive migration
[20261021_223053_admin_recovery_one_armed_run.sql](../src/server/migrations/20261021_223053_admin_recovery_one_armed_run.sql)
adds a partial unique armed-state index. It refuses ambiguous historical armed
data with a bounded review error, without choosing or cancelling codes. Terminal
history remains unrestricted. The schema anchor and generated snapshot include
the index. Plaintext material is returned only after the operator transaction
commits; no automatic retry was added for uncertain commit/output results.

The [runbook](ADMIN_RECOVERY_RUNBOOK.md) now covers atomic replacement, required
force cancellation, explicit login, actual expiry-audit behavior and a metadata-only
legacy-data review procedure. The backend architecture skill's
[recovery reference](../.agents/skills/harmoniarr-backend-architecture/references/admin-recovery-atomic.md)
now covers absent-row admission, lock order, uniqueness and migration refusal.

## Final source and evidence

Ten code/schema/test files belong to final source fingerprint **3248 files**:

```text
c55e547abe6e35a7ea564e08d73ab26982117666cf3dea02f6d2cf9185ab272b
```

| Gate | Observed result |
| --- | --- |
| Focused recovery/completion/operator/route/store/maintenance/schema-anchor checks | 53 passed |
| Selected native PostgreSQL, CLI, routes and built browser consumers | 26 passed, zero failed/cancelled/skipped |
| Final `npm run validate:fast` | 10,792 passed: 5,625 server, 4,470 client, 697 scripts |
| Static/lint/ESM/migration/snapshot policy and both builds | Passed through final fast gate |
| Existing Vue warnings | 225, unchanged and not suppressed |
| Client artifacts | Same 155 files used for native proof and final fast build |
| Database-backed schema validation | 112/112 migrations, zero drift/pending/unknown/non-applied rows; 154 matching anchors |
| Snapshot refresh | Generated through the repository command from all 112 migrations |
| Backend and standards skill validators | Passed |

Final gates had zero failures, cancellations and skips. The final native cohort
completed in about 84.46 seconds; this is an observation under the current load,
not a timeout budget or a whole-suite performance claim.

Native empty-state calls observed an actual lifecycle advisory wait and produced
one armed run, one service result carrying recovery material, one conflict and one arm audit.
Queued explicit force replacement produced one final armed row, invalidated the
old material and derived arm/expiry time after waiting. Maintenance denial kept
the old state/audit digest intact, while explicit cancellation stayed available.

Injected failures after actual cancellation, cancellation audit, replacement
insert, arm audit, disarm audit and initial-arm audit restored complete private
run/audit digests and preserved Error/null. Explicit later operations succeeded.
No generated codes or stored credential hashes were printed in evidence.

Both completion/cancellation orders were observed through native PostgreSQL waits:
completion winning gave cancellation a truthful no-active-run refusal without a
cancel audit; cancellation winning prevented the pending completion from creating
an account. Expiry committed by a row holder was checked after the wait and
persisted as expiry rather than cancellation. A bypass writer received native
23505 from the unique index; terminal history remained. Controlled ambiguous
legacy data made the migration SQL refuse without changing runs or audits.

The selected prior consumers preserve atomic completion, five-attempt exhaustion,
maintenance serialization, CLI lifecycle, explicit later login, session revocation,
code replay refusal and mounted browser error/status/focus behavior. Browser
assets remain unchanged. The selected cohort is explicit:

```powershell
node --test --test-concurrency=1 test/integration/admin-recovery-lifecycle.test.js test/integration/admin-recovery-atomic.test.js test/integration/admin-recovery-routes.test.js test/integration/admin-recovery-cli.test.js test/integration/maintenance-lock-transaction-serialization.test.js test/browser/recovery-form-feedback.test.js
```

The first fast attempt stopped at copyright policy before test execution: the
repository migration scaffold omitted its required header. Added the header,
regenerated the snapshot/checksum, preserved the earlier source/logs, then repeated
focused/native/database validation on the final fingerprint. The earlier passing
native run is retained as pre-header evidence, separately from final qualification.
No deadline, skip policy, assertion or production dependency was weakened.

## Scope and follow-up

MCP GitHub queries at the beginning and end found zero open PRs. None was available
to implement, rebase, close or merge. Work stayed on main without a release, tag,
version or dependency update. The
[preserved Docker upgrade](LOCAL_DOCKER_RECOVERY_LIFECYCLE_OUTCOME.md) records
packaged migration/readiness evidence separately; no recovery run was armed there.

Lost COMMIT acknowledgement, process death during commit and failed one-time CLI
output are not qualified by rollback proof. CLI cleanup/output handling remains
separate from the committed database boundary. Physical screen-reader/device
checks remain deferred; existing browser checks do not establish speech or full
WCAG conformance. The unchanged exhaustive integration and engine/zoom matrices
were not repeated, and no whole-suite timing improvement is claimed.

Next, qualify the **recovery CLI cleanup and one-time output boundary**. The CLI
currently closes the pool before output and its writer calls process exit after
writing. Prove primary Error/null preservation, actual output drainage and safe
guidance when arming committed but material was not delivered, without automatic
retry. Also retain the reproduced scaffold-header omission as a small authoring
tool follow-up to prevent avoidable validation failures. See
[design tradeoffs](RECOVERY_LIFECYCLE_DESIGN.md) and
[official October research](RECOVERY_LIFECYCLE_RESEARCH_2026_10.md).
