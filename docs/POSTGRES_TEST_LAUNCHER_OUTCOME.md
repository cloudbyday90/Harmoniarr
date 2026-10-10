# Parent-owned PostgreSQL test launcher outcome

October 10, 2026, America/New_York. Baseline main: 209aee2.
Separate [design](POSTGRES_TEST_LAUNCHER_DESIGN.md) and
[research](POSTGRES_TEST_LAUNCHER_RESEARCH_2026_10.md) precede launcher code edits.

## Implemented behavior

The explicit `npm run test:integration:shared-postgres` profile runs the existing
Wanted and scan-catalogue files serially against one newly owned PostgreSQL server.
Each file retains native Node isolation/reporters and each scenario retains its
fresh database/pool. Wanted retains its private migration-only template. The
complete/default integration command is unchanged; the CLI accepts only this
verified cohort, with optional explicit subsets.

Narrow ESM modules own the server, file selection, process/output lifecycle,
platform termination, loopback transport, capability registry, PostgreSQL identity
store and launcher orchestration. Child fixtures reserve an observed-absent name,
acknowledge successful creation with role/OID before use, and release only after
verified absence. Parent reconciliation follows actual runner close and known
worker absence before another file. Uncertain/replacement identities fail closed.
The first test/cancellation error, including null, survives secondary cleanup.

## Local comparison

Unchanged baseline main `209aee2`: 18/18 cases, zero failures/cancellations/skips,
69.82s native duration, **69.96s command wall**. First shared profile: 18/18 cases,
zero failures/cancellations/skips, **55.12s command wall**, 51.61s launcher duration.
That pair is 14.84s/about 21.2% faster locally. It does not establish repeatable CI
capacity or a complete-gate speedup. Native summaries are 10 Wanted and 8 catalogue
cases; don't add nested suite counts or phase durations to wall time.

| Observed phase | Baseline | Shared profile |
| --- | ---: | ---: |
| Container startup | 2 / 7.50s total | 1 / 4.16s |
| Container stop | 2 / 1.99s total | 1 / 0.96s |
| Database registration | absent | 44 / 0.36s total |
| Verified release | absent | 44 / 0.21s total |
| Private template preparation | 1 / 1.66s | 1 / 1.87s |

All 44 registered databases were released; normal-run reaping was zero. Saved
local logs/state/phase comparison reside in `.tmp/postgres-test-launcher-2026-10/`.
The remaining wall difference includes application/fixture/host variability; the
container phase reduction does not explain or prove the entire speed difference.
After peer corrections, the final profile again passes 18/18, zero failures/
cancellations/skips: **51.64s command wall**, 50.35s launcher duration, one server,
44 registered/released and zero reaped. Compared with the same baseline this is
18.31s/about 26.2% faster; it remains a local observation with one baseline rather
than a controlled multi-host performance study. The baseline native runner executes
catalogue then Wanted; the explicit profile executes Wanted then catalogue.
File ordering, host cache and command wrappers differ, so this is evidence for
the observed profile, not causal attribution of all saved time to container reuse.

## Validation status

Final boundary controls: 22 registry/store, 21 process/termination, 17 client/
temporary hooks, 15 template hooks, and 11 launcher/server/control cases, all pass
with no failures/cancellations/skips. These commands overlap earlier runs and are
not added to complete-gate counts. Scoped ESLint and test hygiene pass.

Real Windows/native subprocess/PostgreSQL acceptance passes **4/4**, zero
failures/cancellations/skips, 10.99s native duration. It verifies exit after commit
before finally, matching-identity parent reaping with a connected sibling intact,
actual-root cancellation/close/worker absence, and preservation of independently
created uncommitted/replacement canaries (rows, identity and connection admission).
Both deliberately uncertain scopes remain refused rather than adopted.

Peer review led to bounded response streaming, action-specific acknowledgement
validation, stopping a started server after configuration extraction fails, PID 1
refusal and releasing blocked cancelled output consumers. Cancelled output can be
abandoned with `outputDrained:false`, separately from observed process quiescence;
this is failed-run evidence, not successful full drainage. Fixed-error handling
also refuses malformed finish options without reflecting getter diagnostics.
Controlled red/green logs and the original process-test fixture failure are kept.
Final `npm run validate` passes **9,850 tests**: 4,571 server, 4,377 client,
552 script and 350 integration, with zero failures/cancellations/skips. All
copyright/migration/schema/ESM/image/topology/hygiene checks, scoped and complete
lint, and both builds pass. Command wall is **21m14.19s**; native serial integration
is **18m20.34s**. The client build emits its nonfatal Vite plugin-timing diagnostic
(14.14s build); this is not a failing lint/test result. The default scheduling
profile is unchanged, and comparison with another whole-gate run does not establish
causal throughput improvement from this opt-in launcher.

Dedicated untemplated `npm run validate:schema-bootstrap` passes **105/105**
migrations; `npm run validate:security` passes image/topology policy and reports
zero npm vulnerabilities. Maintained standards source/installed copies and the
testing skill pass structural validation; all four maintained standards files
match by SHA256. Local documentation links pass verification. These checks do not
substitute for complete regression coverage or prove broad security/accessibility.

## Recommendation stack and tradeoffs

1. Keep the complete serial native gate as the final regression baseline. It has
   broad coverage; its long wall time remains a cost.
2. Use affected focused tests plus the opt-in verified shared-server cohort during
   development. It removes a measured startup/stop repetition while preserving
   isolation; additional control/lifecycle code and a limited allowlist are costs.
3. Retain prepared per-file schema sources and fresh scenario clones. Repeated
   migrations shrink substantially; fingerprint, sealing and clone checks add cost.
4. Require positive database identities, authenticated bounded control, actual
   process closure and refusal of uncertain cleanup. These prevent mistaken
   sibling/replacement deletion; incomplete cleanup must stop the selected run.
5. Maintain the standards skill's source-to-owner/failure/evidence method. Applicable
   W3C behavior, Node/PostgreSQL contracts and OWASP practices have distinct owners;
   structural validation alone does not establish accessibility or runtime safety.

Reject sharing one mutable database and expanding to every integration fixture
without registration completeness. Raw Dockerized fixtures, manually created
siblings, unregistered descendants and privileged administrative interference
remain separate boundaries. Windows real cancellation evidence and non-Windows
injected controls must be distinguished from POSIX runtime proof.

Next candidates are `library-release-reconciliation.test.js` and
`library-tag-snapshot.test.js`: initial source inspection shows the same
`createPostgresIntegrationRuntime` / `runIsolatedDatabase` boundary, rather than
raw database creation in those files. This is a preliminary owner trace, not an
admission certificate. Audit their downstream database creation and legacy held
gates/cancellation, prove all registrations and cleanup with unchanged cases,
then measure a complete equivalent scheduling profile before changing the default
gate. Discovery-request recomputation remains the next
product task. Work stays on main without release, branch, tag, deployment or PR merge.

## Final evidence freeze

Sixteen retained log/state/source-manifest hashes are inventoried in
`.tmp/postgres-test-launcher-2026-10/validation-evidence-final.json`, SHA256
`f2d7c9f771a5a826068110b3611bb18509e49de41255091458d7cc0fdcdd549e`.
The 26 changed code/config files match their pre-gate SHA256 manifest after final
validation. Local links across all 12 changed Markdown documents resolve.
The refreshed [PR assessment](OPEN_PR_APPLICABILITY_TEST_LAUNCHER_2026_10_OUTCOME.md)
at 19:46:03 UTC again has no unreplayed eligible candidate. Original failed
controls and first-pass logs remain alongside final passing evidence.
