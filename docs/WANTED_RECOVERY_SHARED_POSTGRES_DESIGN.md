# Wanted and recovery shared PostgreSQL pilot

October 12, 2026. Main baseline `6df4d6b`. Separate
[research](WANTED_RECOVERY_SHARED_POSTGRES_RESEARCH_2026_10.md) and outcome
documents record source guidance and executed evidence. This continues the
[fixture-reset follow-up](POSTGRES_FIXTURE_RESET_OUTCOME.md).

## Selected scope and ownership audit

Wanted already belongs to the four-file shared allowlist and uses its private
migration template. Pilot it alongside the nine-case Music Queue recovery
transaction suite. Keep all 19 existing assertions/cases, serial file processes,
fresh scenario databases/pools, max two pool clients, 10-second checkout and
90-second scenario deadlines. Recovery still builds empty databases and runs
real migrations per scenario; this pilot introduces no recovery schema cache.

Both suites create through the temporary/template owners, which reserve names,
acknowledge CREATE, commit the actual OID, assert current ownership before drop,
and release through the parent registry. Independent lock observers use captured
scenario config and close before return. No raw sibling CREATE or external Docker
database is introduced by these two files. The parent closes admission, observes
actual process closure and known-worker absence, and reconciles each file before
admitting another. Preserve unknown/replacement/sibling refusal rules.

Source audit finds two remaining work boundaries: Wanted's local scan adapter
observes lease release but ignores returned completion; recovery's competing
observations use early-rejecting Promise.all. Reuse the completion-aware scan
fixture (registered before launch) and existing first-failure parallel drainage.
Do not create another worker or weaken domain assertions.

Shared children intentionally cannot inspect a container from an external
connection configuration. The parent owns the fresh server and should capture
the existing bounded query/readiness/container-state evidence on file failure,
after admission closes and before scope reconciliation and server disposal.
Preserve the child's original
native failure output and the launcher's primary Error/null; a parent snapshot
does not reproduce or explain an earlier socket failure. Keep container identity
and secrets in the parent capability. Unverified injected servers, reuse, disabled
diagnostics and pre-cancellation cannot launch automatic probes. Diagnostics
must finish before cleanup and cannot change the test result or authorize a retry.

## Alternatives and recommendation stack

| Option | Benefit | Cost or limit | Decision |
| --- | --- | --- | --- |
| Keep separate fresh servers | Simpler per-file ownership | Repeated startup/stop | Matched baseline |
| Run-owned serial shared server | Amortizes server lifecycle while keeping process/database isolation | Needs audited creation/drainage and parent failure evidence | Pilot |
| Persist/reuse containers across runs | Potential warm startup | Unreviewed state/ownership and cleanup | Reject |
| Increase parallelism, pool size or deadlines | Potential throughput/apparent greens | Changes pressure and hides defects | Reject |
| Template all recovery scenarios | Less schema work | Changes migration/recovery preparation evidence | Defer |

Stack: existing isolated subprocess adapter, parent reservation/OID registry,
per-file template/empty schema contracts, actual work drainage, parent-owned
failure-only observation, matched-order measurement. Promote only the audited
recovery file after behavior, normal release accounting and useful measurement
pass. Keep the complete default gate unchanged.

## Measurement and validation contract

Use the same frozen fixture/runtime code, immutable local PostgreSQL image,
file order, native reporters, phase setting, schema modes and resource bounds.
Measure command wall time with a monotonic clock. Baseline uses the existing
file-process adapter and a fresh server per file; candidate uses the same adapter
inside the shared launcher. Require all 19 cases, no cancellation/skip, normal
registered/released equality and zero reaping. Phase spans overlap; do not sum
them as gate wall time. Label single-pair/cache/host variance explicitly.

Focused adverse controls prove actual completion/drainage, parent evidence before
cleanup, first Error/null preservation despite diagnostic failure, cancellation
and no admission of the next file after failure. Native parent failure proof
must preserve a separately owned sibling and verify real query/readiness/state
without copying passwords/tokens. Then measure the pair, validate the selected
public profile (including the other already admitted files), run the fast gate
and finish documentation/skill evidence. Main only; no release, tag, branch or
PR merge accompanies publication.

## Follow-up

If promoted, the next feature is partial two-owner delivery recovery and
fulfilled-source retirement. Further test-profile expansion needs its own owner
audit and measurement. Historical intermittent resets remain unresolved; any
recurrence keeps the original failure and independent observations.
