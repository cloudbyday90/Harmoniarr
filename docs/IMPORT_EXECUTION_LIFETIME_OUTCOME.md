# Import execution lifetime outcome

October 11, 2026. Follow the [design](IMPORT_EXECUTION_LIFETIME_DESIGN.md),
[official research](IMPORT_EXECUTION_LIFETIME_RESEARCH_2026_10.md) and
[PR applicability](OPEN_PR_APPLICABILITY_EXECUTION_LIFETIME_2026_10_OUTCOME.md).

## Implemented behavior

The controlled baseline acquired twice while the first lease release was held
(2 rather than 1). Execution now uses the existing shared ESM task lifecycle:
queued acknowledgement supplies actual completion, duplicate run IDs share it
through finalization and terminal close seals admission and drains captured work.
The original provider protocol, saved origin/consent, final authority guards,
pre-provider refusal and uncertain-acceptance policy are preserved.

Returned preparation, enqueue, confirmation and persistence work remain awaited.
Returned Activity fanout is now owned through settlement with best-effort outcome
policy. Admitted heartbeat renewal drains before captured lease release; release
is attempted after drain failure. Escaping work Error/null remains primary over
cleanup fallout. Expected lease-unavailable/lost outcomes retain their policy;
unexpected acquisition errors become observable. Null domain failures get the
fixed fallback message rather than a secondary error-message TypeError.

The renamed application drain captures concrete execution/apply/scan owners
before awaiting, attempts every known owner despite failure and preserves original
failure identity. Startup uses it after dispatcher and HTTP closure, before pool
closure. Both app fixtures use the same selection ahead of pool/environment and
workspace disposal. Only apply has a proved direct scan launch; no direct execution
to apply launch is inferred from ordering.

Both handoff and scoped-recovery fixture helpers register and retain returned
execution beyond release observation. Callback-observer errors remain fixture
primary even when actual execution also fails; that policy differs from runtime
work/cleanup precedence. Early returned execution failure cannot wait indefinitely
for unreachable release observation. Legacy injected doubles retain callback-only
observation. The native pre-provider helper and unit execution harness also await
the actual handle.

## Validation record

- Controlled red: held-release duplicate acquisition fails 2 versus 1; retained
  locally before the fix.
- A first expanded unit attempt was interrupted because its test used a malformed
  transfer ID, so confirmation never reached the Activity gate. The test was fixed
  to supply a valid UUID and use operation-aware readiness. This was test-input
  correction, not a provider protocol change or passing gate.
- Final focused controls: **101/101**, zero failures/cancellations/skips. Includes
  worker, provider receipt/batch, heartbeat, fixture observation/lifecycle,
  application cleanup, startup, queue handlers and apply/scan owner regressions.
- New standalone native lifetime: **4/4**, zero failures/cancellations/skips,
  23.65 seconds native TAP / 23.79 seconds wrapper. Both functional and reusable
  app fixtures retain actual PostgreSQL, environment and workspace through held
  release, test late admission and preserve scenario null over cleanup failure.
- Complete **npm run validate:fast** passes against the frozen 14-file candidate:
  copyright, migration/schema checks, ESM, images/Compose, lint/test hygiene,
  **9,636 tests** (4,700 server, 4,384 client, 552 scripts), zero failures,
  cancellations or skips, and both builds. Wrapper duration is 164.68 seconds.
- Remaining affected native group: **47/47 across eight files**, zero failures,
  cancellations or skips, 165.25 seconds native TAP / 165.41 seconds wrapper.
  Covers real PostgreSQL confirmation/rollback, pinned batch HTTP, pre-provider
  refusal, scoped recovery, abandoned preparation and apply/scan/dispatcher
  lifetime. The new four native lifetime tests were already passed separately
  and were not repeated in this group. This is affected coverage, not a complete
  native suite. Fast and affected-native wrappers overlapped; timings are not
  additive or matched performance evidence.
- npm audit passes with zero reported vulnerabilities. Source/installed standards
  and the maintained testing skill pass three structural validators, and all four
  installed standards files match their source hashes. This is narrow maintenance,
  not a new blind skill trial or whole-system security assessment.

Local versions were read: Node 24.18.1, npm 12.0.2, pg 8.23.0, pg-pool 3.14.0
and Testcontainers PostgreSQL 12.1.0. The existing media image supplied to the
affected wrapper was verified by immutable ID; no new image or deployment was
built. Supplying that environment is not proof that every native case used media
tools. The wrapper restores its prior environment in finally.

Commands at the repository root:

```powershell
node --test --test-reporter=tap test/server/import-execution-worker-lifetime.test.js test/server/import-execution-fixture-completion.test.js test/server/app-worker-lifecycle.test.js test/server/fixture-worker-observation.test.js test/server/fixture-lifecycle.test.js test/server/import-candidate-execution-worker.test.js test/server/import-execution-batch-handoff.test.js test/server/import-candidate-execution-heartbeat.test.js test/server/startup-runtime.test.js test/server/operation-queue-handlers.test.js test/server/import-candidate-apply-worker-lifetime.test.js test/server/library-scan-worker-lifetime.test.js
node --test --test-concurrency=1 --test-reporter=tap test/integration/import-execution-worker-lifetime.test.js
npm run validate:fast
$env:HARMONIARR_INTEGRATION_MEDIA_IMAGE = 'sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2'
node --test --test-concurrency=1 --test-reporter=tap test/integration/import-execution-handoff-confirmation.test.js test/integration/import-execution-batch-handoff.test.js test/integration/import-execution-pre-provider-refusal.test.js test/integration/music-queue-recovery-execution.test.js test/integration/import-execution-abandoned-preparation.test.js test/integration/apply-worker-lifetime.test.js test/integration/library-scan-worker-lifetime.test.js test/integration/operation-dispatcher-lifetime.test.js
npm run validate:security:npm
```

Private evidence is retained in .tmp/import-execution-lifetime-2026-10-11/:
baseline, rejected/intermediate attempts, focused/native/fast logs, immutable
source/index hashes, candidate patch and MCP responses. Original case/suite and
connection bounds remain; no existing assertion was weakened or test skipped.

## Recommendation stack and next work

Use existing durable queue and current lease/authority guards; modular ESM task
ownership; explicit queued completion; advisory and renewal/release drainage;
captured application owners; native pool lifetime; bounded failure diagnostics
and risk-selected test groups. Benefit: no known duplicate admission or fixture
teardown during execution finalization. Cost: cooperative shutdown can wait for
unfinished dependencies, and remaining workers still need their own proof.

Next: own media-inspection worker completion and returned media/provider work.
Its current active marker is deleted before release at
src/server/import-candidates/import-candidate-media-inspection-worker.js:184 and
its queued launch remains detached. Audit transcode and periodic producers after
that, preserving recovery authority and uncertain provider acceptance. Keep the
residual app-fixture wait until remaining owners are proven.

This does not certify remote download completion, hidden callbacks, complete app
quiescence, historical SQL-reset remediation, W3C/WCAG or system security. Separate
timings are not additive coverage or a matched full-suite benchmark. No schema,
route, dependency, release, PR merge, new branch or deployment rebuild occurs.
