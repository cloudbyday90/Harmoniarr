# Atomic admin-recovery outcome

Validated October 21, 2026 on main with Node 24.22.0/npm 12.0.2 and disposable
native PostgreSQL fixtures. The baseline reproduced two successful completions
of one code/run, two created accounts and two completion audits. An injected
session-revocation failure separately left a created account persisted, the run
armed and the old session valid. These are local native reproductions, not a
claim of an arbitrary cross-origin browser exploit.

## Implemented boundary

Completion now uses the existing borrowed-client transaction runner. A separate
ESM completion service owns policy and orchestration; a narrow account store owns
the native username upsert. The recovery store accepts explicit transaction
queryables for completion writes and fresh run ownership. The previous inline
account SQL and independent writes were removed from the parent service.

Hashing occurs before borrowing a transaction client. The transaction takes the
maintenance table guard before run/account row locks, rechecks holds and locks
the originally observed run. A second statement observes its current state and
database wall time after waiting. A pending request cannot switch to a replacement
run. Guarded consumption checks state, attempt budget and `clock_timestamp()`
expiry, and a refused consume rolls back account/session changes.

Account upsert, session revocation, run completion and both success audits commit
together. Wrong-code attempts and threshold invalidation deliberately commit
before returning their business refusal. Operational failure rolls changes back.
The visible recovery maintenance activity lock retains its separate lifecycle;
cleanup preserves the primary Error/null. A release failure after successful
commit still reaches the caller as a failure, and no automatic retry was added.

Public response shapes and explicit subsequent login remain unchanged. No client,
dependency, schema, migration, release or tag change is required. The former
mock-SQL existing-user test was replaced by real PostgreSQL upsert/flag/login
qualification, alongside focused transaction-owner checks.

## Final source and qualification

Reviewed the final source before complete validation. Seven code/test files
belong to source fingerprint **3244 files**:

```text
8874222002ac25f1165e6af35c765471d24cfa28fa2360eb9dfcd82031d199bd
```

| Gate | Observed result |
| --- | --- |
| Focused recovery service/store/completion/routes and maintenance guard | 43 passed |
| Selected native PostgreSQL, CLI, routes and built browser consumers | 18 passed, zero failed/cancelled/skipped |
| `npm run validate:fast` | 10,787 passed: 5,620 server, 4,470 client, 697 scripts |
| Static/lint/ESM/schema policy and both builds | Passed through fast gate |
| Existing Vue test warnings | Same 225; not suppressed |
| Client artifacts | Same 155 files used for native proof and final fast build |
| Backend architecture and web standards skill validators | Passed |

All reported gates had zero failures, cancellations and skips. Source review and
focused/native qualification preceded the single complete fast gate for the
stable candidate. No deadline, skip policy or production dependency was relaxed.

The native overlap case arranged two valid prepared calls, observed an actual
run-row wait through an independent connection and produced exactly one account
write, one success, one 401 refusal and one completion audit. The old session was
revoked, and later replay was refused.

Failure injection after actual account, session, run and second-audit writes
preserved original Error/null and restored private digests of complete
account/session/run/audit projections. No credential material was printed.
Maintenance activity rows were released; an explicit retry after audit rollback
completed successfully. A separate native consume predicate refused stored
database expiry after account/session writes and rolled those writes back too.

Other native cases prove force-rearm during hashing cannot retarget a pending
request; expiry committed by a row holder is observed after the real wait; seven
wrong-code calls consume exactly five attempts with one invalidation audit; later
restore acquisition waits for recovery commit; and an existing disabled account
retains its identity while login flags/role/password are restored. Prior sessions
are revoked, and the new password works through explicit HTTP login.

The selected unchanged consumers prove public status/completion behavior, native
hold refusal, attempt exhaustion, no automatic login/cookie, browser feedback,
owned focus, CLI arm/status/cancel and shared maintenance serialization. The
cohort completed in approximately 50.73 seconds; this local observation is not a
timing cap or a whole-suite speed claim.

```powershell
node --test --test-concurrency=1 test/integration/admin-recovery-atomic.test.js test/integration/admin-recovery-routes.test.js test/integration/admin-recovery-cli.test.js test/integration/maintenance-lock-transaction-serialization.test.js test/browser/recovery-form-feedback.test.js
```

The backend architecture AI skill now routes recovery changes through
[atomic recovery](../.agents/skills/harmoniarr-backend-architecture/references/admin-recovery-atomic.md).
The standards feedback reference links that boundary so a browser pending owner
cannot be mistaken for server single-use authority.

## Limits and next recommendation

MCP GitHub searches at the beginning and end found zero open PRs. None was
available to implement, rebase, close or merge. Armed recovery proof used fresh
disposable databases, with independent observer and controlled-work cleanup;
it did not arm the user's preserved installation. The
[Docker rebuild](LOCAL_DOCKER_RECOVERY_ATOMIC_OUTCOME.md) records deployment
readiness separately.

Lost COMMIT responses, operating-system failure during commit, failed cleanup
after durable success and arbitrary external I/O quiescence are not qualified by
these rollback tests. No automatic retry or new exactly-once response claim is
made. Concurrency proof covers competing recovery calls and maintenance, rather
than independent sign-in/session issuance. Actual screen-reader speech/device checks remain deferred; the unchanged
browser feedback consumer does not establish complete WCAG conformance. The
unchanged exhaustive integration and three-engine/tab-zoom matrices were not
repeated for this bounded transaction change.

Next, qualify and make **operator arm/force-rearm/cancel atomic**, including
concurrent arm attempts and one-active-run enforcement. Current force-rearm
cancels its observed run before checking maintenance admission and inserting the
replacement; that multi-step path remains outside this completion transaction.
Reproduce its failure/concurrency behavior before choosing coordination or a
schema constraint. See [design tradeoffs](RECOVERY_ATOMIC_DESIGN.md) and
[official October research](RECOVERY_ATOMIC_RESEARCH_2026_10.md).
