# Recovery CLI result delivery outcome

Implemented October 21, 2026 on main using Node 24.22.0/npm 12.0.2. Six server
files now separate one-record output, bounded error policy, execution/cleanup,
presentation and command dispatch. Recovery service transactions, schema,
dependencies and client behavior remain unchanged.

## Result

Arming, status and cancellation execute once, await one result attempt and attempt
pool cleanup once. Committed material is handed off before cleanup. A failed
cleanup preserves the success record and adds bounded stderr guidance with
nonzero exit. A failed result write never replays stdout or recovery material.
Primary Error/null survives privately alongside ordered secondary failures.

The writer uses native callback/error/close handling and graceful exit status.
It preserves borrowed streams and unrelated listeners. Expected business errors
retain exit codes 0–4 through fixed public messages; unknown failures are
unconfirmed outcomes without raw Error/stack disclosure. Dispatch refuses
inherited names; invalid options/TTL refuse before service work. Status explicitly
projects approved fields. The [runbook](ADMIN_RECOVERY_RUNBOOK.md) explains
success output with failed cleanup, partial delivery and explicit operator review.

The standards AI skill now includes a focused
[CLI delivery workflow](../.agents/skills/harmoniarr-web-standards/references/cli-result-delivery.md),
linked from backend and validation guidance. It connects Node lifecycle contracts,
OWASP secret minimization, authoritative database state and W3C web-feedback limits
to distinct observable tests. See the [design and alternatives](RECOVERY_CLI_DELIVERY_DESIGN.md)
and [official October research](RECOVERY_CLI_DELIVERY_RESEARCH_2026_10.md).

## Final candidate and qualification

Eight code/test files belong to the final source fingerprint, **3,253 files**:

```text
31fb38610b1ff7f4bf81b25b1316c7a810b7cd650870804479ff3d1e4f127b6e
```

| Check | Result |
| --- | --- |
| Existing CLI plus new focused delivery tests | 34 passed |
| Selected native PostgreSQL/actual CLI/lifecycle cohort | 12 passed; zero failed, cancelled or skipped |
| Final `npm run validate:fast` | 10,806 passed: 5,639 server, 4,470 client, 697 scripts |
| Static, lint, copyright, ESM, migration/snapshot policy and both builds | Passed through the final fast gate |
| Existing Vue warnings | 225, unchanged and not suppressed |
| Client artifacts | Same 155 files before proof and after the final build |
| Standards, backend and validation skill checks | Passed |

All final test gates had zero failures, cancellations and skips. The complete
fast gate ran once on the stable source; targeted/native proof preceded it.

Focused proof covers held callback/backpressure, callback-before-error listener
lifetime, synchronous null failure, premature/already closed output, one cleanup
attempt, original Error/null under secondary failure, stable refusal codes,
private-data omission, actual child stdout/stderr bytes and broken destinations.

Native database proof ran actual CLI arm/status/conflict/cancel processes through
complete JSON, exit and stdio closure. Held native Writable delivery observed the
already committed run/audit before cleanup, then retained a usable code through
cleanup's null failure. Output failure and an injected post-commit service failure
left exactly one armed run/audit, with no automatic retry. Status returned no code;
explicit later cancellation remained available.

The selected existing operator lifecycle consumer retained empty-state
serialization, force replacement, maintenance denial, rollback after actual writes,
both completion/cancellation orders, fresh expiry checks, uniqueness and migration
refusal. The complete selected native cohort was:

```powershell
node --test --test-concurrency=1 test/integration/admin-recovery-cli-delivery.test.js test/integration/admin-recovery-cli.test.js test/integration/admin-recovery-lifecycle.test.js
```

It completed in about 35.01 seconds under the current host load. This observation
does not change timeout/concurrency policy or claim whole-suite speed improvement.
No deadline, assertion, skip policy or production dependency was weakened.

The pre-change Windows probe reproduced a command resolving before its output
promise but delivered all 4,194,305 benign pipe bytes. A separate isolated Linux
probe against the preceding packaged image reproduced forced-exit truncation:
**80,640 of 4,194,305 bytes**, exit 3. Its owned container was retired. The
probe uses a deliberately large benign record; it does not reproduce loss of an
actual small recovery JSON record. The
[Docker outcome](LOCAL_DOCKER_RECOVERY_CLI_DELIVERY_OUTCOME.md) records the candidate
Linux callback/backpressure and actual EPIPE proof separately from readiness.

## Scope and next work

MCP GitHub searches at selection and completion found zero open PRs. None was available for local
implementation, rebase, closure or merge. Work stays on main without a release,
tag, version or dependency update.

Native lost PostgreSQL COMMIT acknowledgement and process death during commit
remain unqualified. The injected post-commit service failure is a caller-outcome
control, not that native fault. Local write callback success cannot establish
human receipt, downstream parsing or durable file sync. A stalled output can keep
the CLI open; closed stderr cannot receive recovery guidance. No plaintext replay
or automatic mutation retry was introduced. Native pool shutdown failure was not
injected: an unreleased handle can keep a gracefully exiting process alive even
after its nonzero exit status is set. Cleanup-failure controls prove result/error
preservation, not guaranteed native resource retirement after failed shutdown.
Physical screen-reader/device checks
remain deferred; no new WCAG conformance claim is made.

Next recommended implementation: fix the **migration authoring scaffold's missing
required copyright header**, then test a fresh generated migration against the
cheap policy gates before costly qualification. This was reproduced in the prior
round and remains unchanged here. Separately review the newly observed Node
24.22.1 patch against the pinned 24.22.0 baseline before any future claim of latest
runtime coverage; this delivery fix does not establish patch compatibility.
