# Media inspection lifetime outcome

October 11, 2026. See the [design](MEDIA_INSPECTION_LIFETIME_DESIGN.md),
[official research](MEDIA_INSPECTION_LIFETIME_RESEARCH_2026_10.md) and
[PR assessment](OPEN_PR_APPLICABILITY_MEDIA_INSPECTION_LIFETIME_2026_10_OUTCOME.md).

## Implemented behavior

The controlled baseline acquired twice while the first final lease release was
held (2 rather than 1). Media inspection now reuses shared ESM task, advisory,
cleanup and lease owners. Queued start supplies actual completion; duplicate run
IDs coalesce through full finalization. Terminal close seals admission before
waiting and preserves escaped failures including null.

Selected-candidate filtering, diagnostics caps and media preview policy remain.
Returned Activity fanout drains under its existing best-effort outcome policy.
Admitted heartbeat renewal drains before captured lease release; release is still
attempted after drain failure. Escaped work Error/null wins over cleanup fallout.
Unexpected acquisition errors are observable and null domain failure uses a fixed
message. Lease-unavailable is skipped only before a lease is acquired; the existing
domain failure policy remains for a lease-coded dependency error after acquisition.
Lease-lost, pause and cancellation retain their existing domain/release behavior.

Application drainage captures execution/inspection/apply/scan owners before any
await, preserves receivers, attempts all known cleanup after failures and retains
the original Error/null. Startup drains them after dispatcher and HTTP closure;
both app fixtures drain before pool/environment and workspace teardown. No direct
inspection-to-worker launch was found. Only apply has a verified direct child scan
launch; additional ordering is conservative rather than a new dependency claim.

Existing media inspection and command services remain unchanged: shell-free argv,
binary allowlist, configured timeouts, output caps and normal command close remain
their policy. Gated checks trace the actual preview/inspection/command chain and
keep process exit, closed stdio, persisted status and worker completion separate.
Error/reporter and hidden descendant behavior are not certified by normal-close
proof. The native controlled Node probe emits ffprobe-shaped JSON; it proves a
process lifetime and does not validate the ffprobe executable itself.

## Validation evidence

- Retained controlled red: duplicate acquisition during held final release fails
  2 versus 1 before the runtime change, then passes with actual ownership.
- Final focused group: **87/87**, zero failures/cancellations/skips. Includes
  worker coalescing, handler acceptance, media command/inspection/preview,
  diagnostics, service/summary, lease fencing, startup, application failure
  precedence and existing execution/apply/scan owner regressions.
- Selected native PostgreSQL/process group: **25/25 across seven files**, zero
  failures/cancellations/skips, 73.65 seconds native TAP / 73.77 seconds wrapper.
  Includes five new native lifetime checks, Import Review maintenance/operation
  routes, post-apply child scan and existing execution/apply/scan/dispatcher owner
  regressions. Both app fixture entrypoints retain PostgreSQL, environment and
  workspace through held release and preserve scenario null over cleanup error.
  A native controlled Node process remains alive while emitted output is available;
  inspection completion waits for normal process/stdout closure and finalization.
- Complete **npm run validate:fast** passes: copyright, migration/schema, ESM,
  image/Compose checks, lint/test hygiene, **9,651 tests** (4,715 server, 4,384
  client, 552 scripts), zero failures/cancellations/skips and both builds. Wrapper
  duration is 121.15 seconds. Both complete fast and selected native validation
  used the six frozen source/index files. Fast/native wrappers overlap; their
  timings are separate observations, not additive spans or matched speedup evidence.
- Scoped lint and npm audit pass; audit reports zero vulnerabilities. Source and
  installed standards plus the testing skill pass three structural validators;
  all four installed standards files match source hashes. This is narrow reference
  maintenance, not a new blind behavioral skill trial.

Versions were read locally: Node 24.18.1, npm 12.0.2, pg 8.23.0, pg-pool 3.14.0
and Testcontainers PostgreSQL 12.1.0. The existing media image supplied to the
native wrapper was verified as
sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2.
Supplying that environment does not certify tool usage in every case. The wrapper
restores its prior environment in finally. No image or deployment was rebuilt.

Commands at the repository root:

```powershell
node --test --test-reporter=tap test/server/media-inspection-worker-lifetime.test.js test/server/import-candidate-media-inspection-worker.test.js test/server/import-candidate-media-inspection-diagnostics.test.js test/server/import-candidate-media-inspection-service.test.js test/server/import-candidate-media-inspection-summary-service.test.js test/server/import-candidate-apply-preview-service.test.js test/server/media-command-service.test.js test/server/media-inspection-service.test.js test/server/import-worker-lease-fencing.test.js test/server/app-worker-lifecycle.test.js test/server/startup-runtime.test.js test/server/operation-queue-handlers.test.js test/server/import-execution-worker-lifetime.test.js test/server/import-candidate-apply-worker-lifetime.test.js test/server/library-scan-worker-lifetime.test.js
npm run validate:fast
$env:HARMONIARR_INTEGRATION_MEDIA_IMAGE = 'sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2'
node --test --test-concurrency=1 --test-reporter=tap test/integration/media-inspection-worker-lifetime.test.js test/integration/import-review-operations.test.js test/integration/import-apply-post-apply-scan.test.js test/integration/import-execution-worker-lifetime.test.js test/integration/apply-worker-lifetime.test.js test/integration/library-scan-worker-lifetime.test.js test/integration/operation-dispatcher-lifetime.test.js
npm run validate:security:npm
```

Private evidence is retained in .tmp/media-inspection-lifetime-2026-10-11/:
original worker/test snapshots, red/green/intermediate/final focused logs, stable
candidate patch and hashes, MCP sources/PR scopes and gate results. Original case,
suite and connection deadlines remain; no assertion was weakened or case skipped.

## Recommendation stack and next item

Keep durable operation runs and captured lease guards; narrow ESM lifetime
factories; explicit queued completion; awaited media preview; returned diagnostic
ownership; renewal/release cleanup; captured application drainage; native pool
lifetime; focused boundary and affected PostgreSQL/process validation.
Benefit: prevents known duplicate execution and resource teardown during inspection
finalization. Cost: cooperative closure waits for unfinished dependencies and other
platform owners still require explicit proof.

Next: own transcode-orchestration completion and returned transcode work. Its
current active marker is removed before captured release at
src/server/import-candidates/import-candidate-transcode-worker.js:187 and queued
launch is detached. Trace actual file mutation and any downstream handoff before
choosing drain order. Then audit remaining periodic producers and command-error/
hidden-work boundaries before removing residual waits or promoting exhaustive test
scheduling changes. Historical SQL reset causes remain unconfirmed.

This is affected coverage, not exhaustive native validation, whole-system
security/WCAG certification, full application quiescence or a matched full-suite
performance benchmark. No route, schema, dependency, branch, release, remote PR
merge or deployment rebuild changes are included.
