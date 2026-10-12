# Wanted and recovery shared PostgreSQL outcome

October 12, 2026. Main baseline `6df4d6b`. Separate
[design](WANTED_RECOVERY_SHARED_POSTGRES_DESIGN.md) and
[official research](WANTED_RECOVERY_SHARED_POSTGRES_RESEARCH_2026_10.md) own the
selected stack, alternatives and applicable source status.

## Implemented ownership and failure behavior

Wanted now reuses the scan fixture that registers actual returned completion
before launch and waits beyond lease-release observation. Recovery's competing
observations use existing first-observed-failure drainage instead of an early
Promise.all rejection. All 19 original cases and their SQL/authority/rollback
assertions remain. Wanted retains its sealed per-file template; recovery retains
empty scenario databases and real migration calls. Pool/checkout/scenario bounds
and serial process isolation stay intact.

The fresh parent server privately holds the existing bounded failure-evidence
capability. After a failed file, admission closes before diagnostics; the parent
awaits independent query/readiness/container-state observations before scope
reconciliation and server disposal. Child native output retains the original
failure. Diagnostic failure cannot replace the launcher's primary Error/null
or admit another file. External/unverified children receive no container identity
or inspection authority; injected container factories remain unverified.

The native parent control deliberately exits a registered child, captures real
healthy query/readiness/running/non-OOM/no-restart state, reaps only its owned
database and preserves an independently owned sibling. Password/scope-token
canaries are absent from records and captured stderr. Current state does not
explain a previous socket failure; historical intermittent resets remain unresolved.

## Matched pilot measurement

Ignored evidence: `.tmp/wanted-recovery-shared-2026-10-12/`. Both profiles used
the same ten-file frozen candidate, fixture order (Wanted then recovery), native
subprocess/reporters, phase setting, schema modes and bounds. An immutable local
PostgreSQL image was captured before the pair:
`sha256:54451ecb8ab38c24c3ec123f2fd501303a3a1856a5c66e98cecf2460d5e1e9d7`.

| Measure | Separate servers | Shared parent |
| --- | ---: | ---: |
| Cases / pass | 19 / 19 | 19 / 19 |
| Failures / cancellations / skips | 0 / 0 / 0 | 0 / 0 / 0 |
| Command wall, monotonic PowerShell stopwatch | 49.013s | 42.824s |
| Adapter wall, monotonic Node clock | 48.113s | 41.878s |
| Container starts | 2 / 5.835s inclusive | 1 / 3.313s inclusive |
| Database creations | 45 | 45 |
| Registered / released / reaped | Standalone owner | 45 / 45 / 0 |

The observed command reduction is 6.189s, about 12.6%; adapter reduction is
6.235s, about 13.0%. This single baseline-first pair has host/cache/order variance;
it does not establish a CI, complete-gate or universally causal speedup. Phase
spans overlap and are not summed as wall time. Promotion adds only the audited
recovery file to the opt-in allowlist. The complete default gate stays unchanged.

After measurement, the selector and its unit coverage changed for promotion,
and failure-only admission ordering was tightened. The successful measured path
is unchanged; retain this pair as the measured candidate and separately verify
the final public profile and adverse failure path. Do not relabel the pair as a
benchmark of those later failure-only changes.

## Executed checks

| Check | Result |
| --- | --- |
| Focused worker/parallel/server/evidence/launcher controls before selector promotion | 35/35; zero failures/cancellations/skips; 2.027s TAP |
| Public selector and failure-order controls after promotion/refinement | 8/8; zero failures/cancellations/skips |
| Native parent controls | 5/5 initially; final admission-order reproof 5/5, 9.107s TAP; zero failures/cancellations/skips |
| Changed JavaScript lint before final freeze | Pass |
| Expanded public `npm run test:integration:shared-postgres` | 43/43 across five isolated files; zero failures/cancellations/skips; 69.668s command wall / 68.683s launcher; 107 registered / 107 released / zero reaped |
| Final `npm run validate:fast` on 11 frozen JavaScript files | 9,982 tests: 5,044 server, 4,384 client, 554 scripts; static checks and both builds pass; 94.088s command wall |
| `npm audit --json` | Zero reported vulnerabilities |
| Skill structure and installed/source integrity | Three validators pass; four standards files have matching SHA-256 |

The first fast pass preceded the failure-only admission-order refinement and is
retained as `fast-before-admission-order.log`; the final gate above supersedes it.
The final native/public/fast checks share exact working/index hashes for all
11 changed JavaScript files. Local Markdown links and whitespace are checked
before publication. Node 24.18.1, npm 12.0.2 and PostgreSQL 18.3 were observed.
The public profile used the existing network-disabled media fixture image
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`;
scoped phase/media settings were restored. No branch, release, tag, deployment
or PR merge is part of this slice. The affected profile and five parent controls
are separate from the repository's complete native integration gate.

## Recommendation and next item

Stack: one newly owned run server; existing reserve/CREATE/OID registry; isolated
file processes and scenario databases; per-file schema contracts; actual work
drainage; parent-owned sanitized failure observations. The benefit is less server
setup with unchanged tested behavior; the cost is ownership/cleanup complexity
and parent registry round trips. Persisted reuse, global parallelism, larger pools
and deadline increases were rejected.

The [MCP PR assessment](OPEN_PR_APPLICABILITY_SHARED_PILOT_2026_10_OUTCOME.md)
found no eligible unreplayed revision. The maintained standards/testing skills
record the ownership and measurement method without a new blind skill trial.

Next feature: partial two-owner delivery recovery and fulfilled-source retirement.
Retain recipient-specific receipts, current consent/root/catalog checks and the
existing durable command owners. Do not retry provider dispatch merely because
one private delivery failed. Further shared-profile expansion needs another
resource audit and measured proof.
