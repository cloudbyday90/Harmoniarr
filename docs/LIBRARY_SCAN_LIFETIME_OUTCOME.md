# Library scan lifetime outcome

October 11, 2026. Controlled original tests reproduced two acquisitions for the
same scan during held final release (2 instead of 1), and standalone fixture
completion before the returned execution settled (true instead of false).
Both rejected controls remain in .tmp/library-scan-lifetime-2026-10-11/rejected-unit.log.
These prove lifetime gaps, not historical bootstrap/authority causes.

## Implemented result

Library scan reuses the ESM task lifecycle. Queued acknowledgement remains
immediate and includes a per-run completion handle; duplicate starts share it
through the full finalizer. Terminal close seals admission and awaits admitted
execution. Late starts refuse with worker_closing. Acquisition and escaping
finalizer failures, including null, are observed/retained; ordinary persisted
failure, pause, cancellation and lease-lost outcomes keep their policy.

Shared worker-lease cleanup drains admitted heartbeat renewal before attempting
captured release, including after drainage failure. Apply now uses that same
narrow helper without changing its advisory policy. Primary work Error/null
wins over cleanup fallout; renewal-drain failure wins over later release failure.
Null domain errors use a fixed fallback message instead of a secondary TypeError.

A small application drain captures actual apply/scan instances, drains apply
first, then attempts scan even after apply failure. Production startup and both
app fixtures use this owner selection before pool/environment/workspace teardown.
The existing dispatcher already consumes the scan acknowledgement completion.
Worker receivers, scenario result and original Error/null are preserved.

Standalone scan fixtures keep registered-before-launch startup and existing
callback-error observation, then await actual execution beyond release observation.
Early execution rejection cannot hang behind an unreachable observer. The
fixture's callback observer remains its primary failure source: if both callback
observation and execution fail, its error wins after actual execution drains.
This fixture policy is separate from the worker's main-work/cleanup precedence.
Legacy
injected doubles without a completion handle keep only their callback boundary;
the default real worker must provide completion.

The separate [design/tradeoffs](LIBRARY_SCAN_LIFETIME_DESIGN.md) and
[MCP official research](LIBRARY_SCAN_LIFETIME_RESEARCH_2026_10.md) own rationale
and source status. Guarded catalogue/tag/match/reconciliation SQL, durable queue,
lease fencing, routes, schema and test scheduling were not changed.

## Executed evidence

- Focused controls: 44/44 pass, no failures/cancellations/skips. They cover both
  reproduced gaps, duplicate handle identity and terminal refusal, exact Error/
  null acquisition/finalizer failures, actual heartbeat renewal before release,
  attempted release after drain failure, bounded null-domain message, ordered
  application drainage after apply failure, unreachable observer rejection,
  callback precedence and existing startup/apply/scan fixture consumers.
- New native app lifetime controls: 4/4 pass separately (35.96 s TAP), then pass
  again in the final affected group. Both app entry points hold real PostgreSQL
  lease finalization across HTTP closure, keep database/environment/workspace
  available, reject late starts, and restore resources only after actual completion.
  Scenario null wins over failing scan cleanup while the cleanup error remains
  observable on worker close. This suite isolates lifetime plumbing with an
  injected empty catalogue callback; existing native consumers prove guarded
  catalogue/metadata behavior.
- Final affected native group: 54/54 pass across eight files, zero failures/
  cancellations/skips. It includes actual catalogue, file-match, release and tag
  persistence, wanted reconciliation, scan/apply lifetime, and dispatcher
  consumption. TAP elapsed time is 533.79 s; wrapper time is 534.64 s
  (8 min 54.64 s). This is scoped native validation, not a complete native gate.
- Complete fast gate: 4,681 server, 4,384 client and 552 script tests, 9,617 total,
  zero failures/cancellations/skips; static/schema/ESM/image/topology, full lint/
  test-hygiene and both builds pass. Monotonic wrapper time is 463.80 s
  (7 min 43.80 s). Fast/native layers ran independently; do not sum their times
  or compare these scopes as a matched full-suite benchmark.
- Scoped lint and repository npm audit pass; zero reported vulnerabilities.
  Host Node 24.18.1, pg 8.23.0 and pg-pool 3.14.0 were read locally. No dependency
  was changed. The existing media image supplied in the native wrapper was
  verified by immutable ID; no new image/deployment was built.

Commands at the repository root:

```powershell
node --test test/server/startup-runtime.test.js test/server/library-scan-worker-lifetime.test.js test/server/library-scan-fixture-completion.test.js test/server/library-scan-worker.test.js test/server/library-scan-worker-fixture.test.js test/server/library-scan-catalogue-worker-fixture.test.js test/server/app-worker-lifecycle.test.js test/server/import-candidate-apply-worker-lifetime.test.js
npm run validate:fast
$env:HARMONIARR_INTEGRATION_MEDIA_IMAGE = 'sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2'
node --test --test-concurrency=1 --test-reporter=tap test/integration/library-scan-worker-lifetime.test.js test/integration/library-scan-catalogue.test.js test/integration/library-file-match.test.js test/integration/library-release-reconciliation.test.js test/integration/library-tag-snapshot.test.js test/integration/library-wanted-release-reconciliation.test.js test/integration/apply-worker-lifetime.test.js test/integration/operation-dispatcher-lifetime.test.js
npm run validate:security:npm
```

The native wrapper restores its scoped media environment in finally. No case,
suite or connection deadlines were extended. Private evidence remains under
.tmp/library-scan-lifetime-2026-10-11/: rejected controls, focused/native/fast logs,
wrapper results, frozen source/index hashes and MCP responses.

## Recommendation and next work

Stack: durable queue/lease fencing; modular ESM completion; returned execution
handles; shared renewal/release cleanup; captured producer-before-consumer
application drainage; native pool lifetime; bounded failure diagnostics.
Benefit: no duplicate admission or teardown during known scan finalization.
Cost: cooperative shutdown waits and continued separate ownership for legacy
workers, child jobs and unreturned callback effects.

The residual 150 ms wait remains. This slice does not certify whole-app quiescence,
historical bootstrap remediation, a full-native pass or a full-suite speedup.
Next: own import-execution completion and its lease/provider finalizers. Current
source still deletes its active marker before lease release and returns only
queued acceptance. Prove the gap and producer handoffs before extending app
drainage, then audit remaining workers/periodic work before deleting the delay.
Only afterward assess exhaustive cohort/remainder dispatch with complete
membership and matched measurements. Historical intermittent failures still
require causal evidence.

The [fresh PR assessment](OPEN_PR_APPLICABILITY_SCAN_LIFETIME_2026_10_OUTCOME.md)
finds no eligible unreplayed patch. Standards/testing references are maintained
without a new standards entrypoint, metadata or invocation policy. Main only;
no new branch, PR merge or release.

Publication checks match all 13 frozen code files in worktree and index.
Eleven changed Markdown documents have 411 resolving local links; whitespace
checks pass. Source/installed standards and the maintained testing skill pass
structural validation, and all four installed standards files match source.
No raw private logs or connection details are committed as evidence.
