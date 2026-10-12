# Library discovery dispatch lifetime outcome

October 11, 2026. See the [design](DISCOVERY_DISPATCH_LIFETIME_DESIGN.md),
[official research](DISCOVERY_DISPATCH_LIFETIME_RESEARCH_2026_10.md) and
[PR assessment](OPEN_PR_APPLICABILITY_DISCOVERY_DISPATCH_LIFETIME_2026_10_OUTCOME.md).

## Implemented behavior

The held-release baseline acquired twice (2 rather than 1). Discovery now reuses
shared ESM task lifecycle, work/cleanup precedence and lease drainage. Queued start
returns actual completion; duplicates remain coalesced through eligible pruning.
Terminal close seals admission before waiting and retains escaped Error/null.

Returned reconciliation, artwork, dispatch and producer handoff work remain
awaited. Admitted renewal drains before captured lease release. Pruning follows
only when cleanup returns without throwing and original acquired/not-lost authority
flags allow it; the existing release-return policy is unchanged. Refused persisted
marks, lost authority, empty/unavailable acquisition and thrown renewal/release
cleanup skip pruning. Eligible handled failure, pause and cancellation still prune.
Escaped work Error/null wins over cleanup fallout. Unexpected acquisition errors
become observable, and null domain/artwork errors use fixed fallback messages.
Artwork remains best-effort while lease loss reaches the outer handler.

Scoped recovery still forwards its owning run and skips global reconciliation/
artwork. Saved consent, current membership, dispatch protocol and provider
uncertainty rules remain. No automatic retry or forced cancellation is added.
Dispatch can queue selected-import execution through its awaited service;
application captures discovery before execution/inspection/transcode/apply/
organize/scan. Only traced queue-producing handoffs determine producer ordering;
other ordering is conservative. Startup and both app fixtures use the same list
before pool/environment/workspace disposal.

The scoped recovery fixture registers actual execution before launch and waits
past release observation, including eligible pruning. Earlier observer errors
remain fixture primary, and an early execution rejection cannot hang behind an
unreachable observer. Native spies now propagate refused persisted marks rather
than reporting them as successful transitions. Unit consumers also await actual
completion, with global-work assertions visible to the parent test rather than
hidden inside best-effort artwork handling. Legacy injected doubles remain
callback-only evidence.

## Validation evidence

- Retained controlled red: duplicate acquisition during held release fails 2
  versus 1, then passes through shared completion ownership.
- Final focused group: **188/188**, zero failures/cancellations/skips across
  19 verified literal paths. Includes reconciliation/dispatch/run services,
  scoped routing, artwork/provider gates, renewal/release/pruning, fixture error
  identity, ordered application/startup and existing seven-owner consumers.
- An initial focused selection passed 177 tests but silently ignored an unmatched
  wanted-reconciliation filename. The actual wanted-release service file was
  identified and included in the verified 188-test run. Both records are retained;
  the omitted selector was not counted as coverage.
- Complete **npm run validate:fast** passes: copyright, migration/schema, ESM,
  image/Compose checks, lint/test hygiene, **9,716 tests** (4,780 server, 4,384
  client, 552 scripts), zero failures/cancellations/skips and both builds.
  Wrapper duration is 153.28 seconds. The successful client build took 3.26
  seconds and emitted a PLUGIN_TIMINGS advisory for plugin hooks; the raw timing
  report is retained, with no cause or matched performance improvement claimed.
- Affected PostgreSQL/HTTP group: **59/59 across 13 verified files**, zero failures/
  cancellations/skips, 208.56 seconds native TAP / 208.69 seconds wrapper. Includes
  five new lifetime cases, scoped consent/membership/recovery, shared-discovery
  correlation, guarded wanted reconciliation and existing seven-owner consumers.
  Both app fixture entrypoints retain database/environment/workspace through held
  release and eligible pruning, including scenario-null versus prune-failure
  precedence. A native loopback HTTP request remains admitted through closure,
  completes persistence before disposal and makes exactly one POST.
- Both gates used ten frozen source/index files. Fast/native wrappers overlapped;
  timings are separate observations, not additive spans or matched benchmarks.
  Intentional scenario-null cases produce expected failure-probe rows rather
  than failed tests or a diagnosis of historical infrastructure errors.
- Scoped lint and npm audit pass; audit reports zero vulnerabilities. Source and
  installed standards plus the testing skill pass three structural validators;
  all four installed standards files match source hashes. This is narrow reference
  maintenance without a new blind behavioral skill trial.

Versions were read locally: Node 24.18.1, npm 12.0.2, pg 8.23.0, pg-pool 3.14.0
and Testcontainers PostgreSQL 12.1.0. The supplied existing media image was verified
as sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2.
That environment does not certify tool use in every case; the native wrapper
restores its prior value in finally. No image or deployment was rebuilt.

Commands at the repository root (literal selections were verified with Test-Path
before invocation; recorded selections are retained in the result JSON files):

```powershell
node --test --test-reporter=tap test/server/discovery-worker-lifetime.test.js test/server/library-discovery-worker.test.js test/server/library-discovery-fixture-completion.test.js test/server/library-discovery-dispatch-service.test.js test/server/library-discovery-dispatch-policy-service.test.js test/server/library-discovery-run-service.test.js test/server/library-discovery-heartbeat.test.js test/server/library-discovery-summary-service.test.js test/server/library-wanted-release-service.test.js test/server/app-worker-lifecycle.test.js test/server/startup-runtime.test.js test/server/operation-queue-handlers.test.js test/server/worker-owner-drain.test.js test/server/import-execution-worker-lifetime.test.js test/server/organize-apply-worker-lifetime.test.js test/server/transcode-worker-lifetime.test.js test/server/media-inspection-worker-lifetime.test.js test/server/import-candidate-apply-worker-lifetime.test.js test/server/library-scan-worker-lifetime.test.js
npm run validate:fast
$env:HARMONIARR_INTEGRATION_MEDIA_IMAGE = 'sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2'
node --test --test-concurrency=1 --test-reporter=tap test/integration/discovery-worker-lifetime.test.js test/integration/music-queue-recovery-discovery.test.js test/integration/operator-shared-discovery-correlation.test.js test/integration/library-wanted-release-reconciliation.test.js test/integration/organize-apply-worker-lifetime.test.js test/integration/transcode-worker-lifetime.test.js test/integration/media-inspection-worker-lifetime.test.js test/integration/import-review-operations.test.js test/integration/import-apply-post-apply-scan.test.js test/integration/import-execution-worker-lifetime.test.js test/integration/apply-worker-lifetime.test.js test/integration/library-scan-worker-lifetime.test.js test/integration/operation-dispatcher-lifetime.test.js
npm run validate:security:npm
```

Private evidence stays in .tmp/discovery-dispatch-lifetime-2026-10-11/:
original worker/test snapshots, red/green/intermediate/final focused logs,
verified selections, frozen hashes/candidate patch, MCP sources/PR scopes and
gate results. Original deadlines and assertions remain; no case is skipped or
expectation weakened. Passing focused timing is not a matched full-suite speedup.

## Recommendation and next item

Stack: durable queue/current authority; narrow ESM completion; awaited scoped
dispatch and producer handoffs; renewal/release then original eligible pruning;
captured ordered application owners; native pool lifetime; verified focused and
affected PostgreSQL/HTTP validation. Benefit: prevents known duplicate execution
and teardown during discovery finalization. Cost: cooperative waits for actual
dependencies, with remote searches and hidden work still requiring their own
contracts.

Next: library external-intake planning completion and its queued execution
handoff. Its active marker is removed before release at
src/server/library/library-external-intake-worker.js:164 and launch is detached.
Trace provider URL/resource authority, saved request ownership and downstream
execution before selecting drain order. Then remaining metadata/provider workers
and periodic producers before deleting residual waits or changing exhaustive
scheduling. Historical SQL-reset causes remain unconfirmed.

This is affected evidence, not exhaustive native validation, full app quiescence,
remote search completion, provider protocol conformance or security/WCAG
certification. No route, schema, dependency, new branch, release, remote PR merge
or deployment rebuild changes are included. Timing spans are separate observations.
