# Owned PostgreSQL failure evidence outcome

October 11, 2026. Fixture failures now capture independent evidence before their
owned server is torn down. This adds diagnosis capability; the prior full-run
timeouts, SQL resets and authority assertion remain unexplained.

## Implemented result

Four narrow ESM modules own immutable record projection, independent host SQL,
captured-container readiness and canonical per-scenario capture. Existing fixture
hooks capture schema/scenario errors before app cleanup and temporary-database
errors before pool/backend/database cleanup. Template clones forward the hook.
One scenario produces at most one capture; both probe completions are awaited.
Success and off mode launch nothing. External, reused, custom/unverified and
pre-cancelled capabilities launch no automatic probe traffic.

The independent pg client privately captures maintenance connection config.
Connect, query and statement limits are each 1,000 ms; its fixed query reads only
version/recovery and native end is awaited. It never borrows the failed pool.
Quiet readiness runs against the default fresh container's captured immutable ID
with shell-free Docker argv, a one-second remote limit, two-second CLI limit,
512-byte output cap and hidden Windows process. Names used by the command are
captured simple fixture identifiers; no password is passed on argv.

Only CLI success reports accepting. Nonzero/transport failures stay failed
command observations with a bounded cliExitCode, because Docker errors can
overlap pg_isready statuses. A forced CLI exit is not remote-work or server-wide
drainage proof. Container readiness does not prove authentication; neither plane
proves the original server/socket was healthy at the earlier error.

Records contain approved codes/classes, typed version/recovery/closed fields,
opaque correlation and monotonic duration. They omit SQL, error prose,
credentials, hosts, ports, database/user names, container IDs and vendor output.
Changing/throwing getters cannot bypass primitive projection. Original Error/null
identity survives failed probes, sinks and cleanup. Setting
HARMONIARR_INTEGRATION_SERVER_DIAGNOSTICS=off disables this facility; invalid
settings refuse before container startup.

See the separate [design and tradeoffs](POSTGRES_FAILURE_EVIDENCE_DESIGN.md) and
[MCP official research](POSTGRES_FAILURE_EVIDENCE_RESEARCH_2026_10.md).

## Executed evidence

- Focused module/adjacent controls: 59/59 passed. Final full server validation
  includes these controls after conservative CLI classification was completed.
  Gates prove deduplication, all-plane completion before publication, Error/null
  precedence, no unowned/success/off traffic, guarded values and native client
  end after failed connect/query. A real bounded-output CLI child closes before
  probe completion; this does not certify arbitrary Docker remote execution.
- Final affected native group: 23/23 passed, no cancellations/skips. Six new
  controls induce actual ECONNREFUSED, authentication refusal (28P01), backend
  termination (57P01), diagnostic authentication failure with accepting readiness,
  and first-schema failure at both app entry points. They hold capture completion
  to prove pool/environment availability, then verify restoration and one record.
  Existing apply-lifetime (5), provider-refusal (9) and Import Review (3) cases
  also pass. Native TAP elapsed time: 59.05 s.
- Final complete fast gate: 4,658 server, 4,384 client and 552 script tests
  (9,594 total), zero failures/cancellations/skips; static/schema/ESM/topology,
  full lint/test-hygiene and both builds pass. Its monotonic wrapper measured
  98.41 s (fast-final-result.json). The final fast and native groups ran as
  independent processes; their durations must not be summed as gate wall time.
  Fast and native groups are separate commands,
  not one exhaustive native run or a matched performance benchmark.
- Host Node 24.18.1, pg 8.23.0, pg-pool 3.14.0 and Testcontainers 12.1.0 were read
  locally. The actual native server reports 180003 (PostgreSQL 18.3), separately
  from current version-18 documentation. No dependency was changed.

Final commands from the repository root:

```powershell
npm run validate:fast
node --test --test-concurrency=1 --test-reporter=tap test/integration/postgres-failure-evidence.test.js test/integration/apply-worker-lifetime.test.js test/integration/import-execution-pre-provider-refusal.test.js test/integration/import-review-operations.test.js
```

The first new native control run was rejected: four of five cases failed,
including failed independent host observation and uncoded errors before intended
authentication/termination assertions. The induced-fault client had a new
one-second connect cap; it now uses the existing fixture connect bound to reach
the intended fault. This does not explain the app-schema timeout from that run.
Original case/suite/app-pool bounds and expected error assertions were not
weakened. Subsequent diagnostic controls passed 5/5, then the expanded group
passed 23/23. That is not a diagnosis of either the rejected control run or
historical failures. Initial lint rejected one duplicate import and promise
executor returns; both were corrected.

Review then caught overlapping Docker/native exit codes. The pre-classification
fast and native results are retained separately and are not promoted as evidence
for the final conservative record contract. Final validation reran after that
material change. Raw private evidence stays under
.tmp/postgres-failure-evidence-2026-10-11/, including rejected/diagnostic/native
logs, final fast/native logs, frozen code hashes and MCP responses.

## Recommendations and remaining scope

Selected stack: owned fixture capabilities; per-scenario completion; independent
native host authentication; bounded captured-container readiness; conservative
immutable records; existing checkout/phase correlation; focused adverse controls
and complete fast validation. Benefit: useful failure evidence before cleanup
without success-path network work. Cost: failure-path probe latency and inability
to infer PostgreSQL rejection from a nonzero Docker CLI exit.

No production route, schema, worker policy, test scheduling, release or residual
150 ms wait changed. The affected native group is not complete native coverage;
the prior commit's complete 369-case diagnostic gate is not claimed for this
candidate. Template-source preparation and parent-owned shared servers are
separate evidence-owner work; no external-server probing or recovery was added.

Next: own the dispatcher's in-progress claim/tick and launched work, then propagate
completion ownership to library scan before removing the residual fixture wait.
Use this new evidence when an intermittent failure recurs; extend parent/source
diagnostics only through their actual ownership contracts. Then assess exhaustive
cohort/remainder dispatch with complete membership and matched timing evidence.
The earlier authority assertion still requires reproduction before causal claims.

The [fresh PR assessment](OPEN_PR_APPLICABILITY_SERVER_EVIDENCE_2026_10_OUTCOME.md)
finds no unreplayed applicable patch. Standards/testing references are maintained;
main only, no new branch, release or PR merge.

Publication checks match all 13 frozen code files in the worktree and index.
Eleven changed Markdown documents have 397 resolving local links; whitespace
checks pass. Source/installed standards and the maintained testing skill pass
structural validation, with all four installed standards files matching source.
The repository npm-audit command reports zero vulnerabilities. No whole-system
security certification or new blind skill trial is claimed.
