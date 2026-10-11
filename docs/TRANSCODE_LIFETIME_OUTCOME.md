# Transcode orchestration lifetime outcome

October 11, 2026. See the [design](TRANSCODE_LIFETIME_DESIGN.md),
[official research](TRANSCODE_LIFETIME_RESEARCH_2026_10.md) and
[PR assessment](OPEN_PR_APPLICABILITY_TRANSCODE_LIFETIME_2026_10_OUTCOME.md).

## Implemented behavior

The controlled baseline acquired twice during held final lease release (2 rather
than 1). Transcode orchestration now reuses shared ESM task, work/cleanup and lease
owners. Queued acknowledgement returns actual completion; duplicate run IDs share
it through finalization, and terminal close seals admission before waiting for
registered work. Escaped failures, including null, remain observable.

Returned selected-summary, preview and per-file preflight work remain awaited.
Admitted renewal drains before captured lease release, which is still attempted
after drain failure. Escaped work Error/null wins over cleanup fallout. Unexpected
acquisition failures escape; expected unavailable acquisition and lease-lost
outcomes retain policy. Lease-coded dependency errors after acquisition retain
ordinary domain failure behavior. Null domain failure uses a fixed fallback.
Filtering, counters, pause/cancellation and preflight status policy remain.

Source tracing corrected the previous broad file-mutation expectation: the wired
execution service runs ffmpeg decode/encode preflight to null output. Actual file
mutation belongs to separate apply/organize services; no direct child-worker
launch exists in this traced body. This change preserves the preflight-only
boundary and its existing command allowlist, shell-free argv, timeout, output cap
and normal close behavior. It introduces no transformed files or new Activity,
provider retry or downstream launch policy.

New worker-owner-drain snapshots ordered concrete owners before any await,
preserves receivers, attempts each despite failures and retains the first
Error/null. Application selection is execution/inspection/transcode/apply/scan.
Startup and both app fixtures share it before pool/environment/workspace disposal.
Apply has a verified scan-producing handoff; other ordering is conservative.
This replaces growing nested cleanup callbacks with a small ESM service.

## Validation evidence

- Retained controlled red: duplicate acquisition during held release fails 2
  versus 1 before the runtime change, then passes with shared actual completion.
- Final focused group: **103/103**, zero failures/cancellations/skips. Includes
  worker coalescing, handler acceptance, preflight/preview, normal exit versus
  stdio close, held-preview cancellation, lease fencing, failure precedence,
  owner-list snapshot/receiver behavior, startup and all five owned-worker
  regressions. Null-output arguments remain explicit at the command boundary.
- Complete **npm run validate:fast** passes: copyright, migration/schema, ESM,
  image/Compose checks, lint/test hygiene, **9,670 tests** (4,734 server, 4,384
  client, 552 scripts), zero failures/cancellations/skips and both builds.
  Wrapper duration is 126.02 seconds.
- Affected native PostgreSQL/process group: **30/30 across eight files**, zero
  failures/cancellations/skips, 99.86 seconds native TAP / 99.98 seconds wrapper.
  Includes five new transcode lifetime checks, both app fixture entrypoints,
  controlled native preflight process, Import Review guards, post-apply child scan
  and existing execution/inspection/apply/scan/dispatcher ownership regressions.
  PostgreSQL, environment and workspace stay available through held final release;
  scenario null remains primary over cleanup failure.
- Both gates used eight frozen source/index files. Fast/native wrappers overlapped;
  their timings are separate observations, not additive spans or matched speedup
  evidence. This native group is affected coverage, not an exhaustive suite.
- Scoped lint and npm audit pass; audit reports zero vulnerabilities. Source and
  installed standards plus the testing skill pass three structural validators;
  all four installed standards files match source hashes. This is narrow reference
  maintenance without a new blind behavioral skill trial.

Versions were read locally: Node 24.18.1, npm 12.0.2, pg 8.23.0, pg-pool 3.14.0
and Testcontainers PostgreSQL 12.1.0. The supplied existing media image was verified
as sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2.
That environment does not certify tool usage in every case; the controlled Node
preflight case explicitly exercises process lifetime rather than ffmpeg encoding.
The wrapper restores its prior environment in finally. No deployment was rebuilt.

Commands at the repository root:

```powershell
node --test --test-reporter=tap test/server/transcode-worker-lifetime.test.js test/server/worker-owner-drain.test.js test/server/app-worker-lifecycle.test.js test/server/startup-runtime.test.js test/server/import-candidate-transcode-worker.test.js test/server/import-candidate-transcode-service.test.js test/server/media-transcode-execution-service.test.js test/server/media-transcode-planning-service.test.js test/server/import-worker-lease-fencing.test.js test/server/media-command-service.test.js test/server/import-candidate-apply-preview-service.test.js test/server/operation-queue-handlers.test.js test/server/import-candidate-apply-worker-lifetime.test.js test/server/library-scan-worker-lifetime.test.js test/server/import-execution-worker-lifetime.test.js test/server/media-inspection-worker-lifetime.test.js
npm run validate:fast
$env:HARMONIARR_INTEGRATION_MEDIA_IMAGE = 'sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2'
node --test --test-concurrency=1 --test-reporter=tap test/integration/transcode-worker-lifetime.test.js test/integration/media-inspection-worker-lifetime.test.js test/integration/import-review-operations.test.js test/integration/import-apply-post-apply-scan.test.js test/integration/import-execution-worker-lifetime.test.js test/integration/apply-worker-lifetime.test.js test/integration/library-scan-worker-lifetime.test.js test/integration/operation-dispatcher-lifetime.test.js
npm run validate:security:npm
```

Private evidence remains in .tmp/transcode-lifetime-2026-10-11/: original worker
and test snapshots, red/green/intermediate/final focused logs, frozen hashes and
candidate patch, MCP sources/PR records and gate results. Original case/suite and
connection deadlines remain; no assertion was weakened or test skipped.

## Recommendation and next work

Stack: durable operation/lease authority; modular ESM completion; awaited
preview/preflight; renewal-before-release finalizers; captured ordered application
owners; native pool lifetime; focused and affected PostgreSQL/process evidence.
Benefit: prevents known duplicate admission and teardown during transcode
finalization with little repeated lifetime policy. Cost: cooperative closure waits
for actual dependencies, and other platform owners still need explicit proof.

Next: own library-organize apply completion through its file mutations and lease
finalizers. Its active marker is removed before release at
src/server/library/library-organize-apply-worker.js:290 and queued launch remains
detached. Trace mutation authority and downstream work before choosing drain
ordering. Then audit remaining workers/periodic producers and command-error/hidden
descendants before removing residual waits or promoting exhaustive test scheduling.
Historical SQL-reset causes remain unconfirmed.

This is affected coverage, not exhaustive native validation, full app quiescence,
codec correctness or whole-system security/WCAG certification. A controlled Node
process establishes process lifetime, not actual ffmpeg encoding behavior. Normal
close proof does not certify command-error/reporter/hidden descendant contracts.
No route, schema, dependency, branch, release, remote PR merge or deployment rebuild
changes are included. Timing observations are not matched full-suite benchmarks.
