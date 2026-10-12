# Library organize apply lifetime outcome

October 11, 2026. See the [design](ORGANIZE_APPLY_LIFETIME_DESIGN.md),
[official research](ORGANIZE_APPLY_LIFETIME_RESEARCH_2026_10.md) and
[PR assessment](OPEN_PR_APPLICABILITY_ORGANIZE_APPLY_LIFETIME_2026_10_OUTCOME.md).

## Implemented behavior

The controlled baseline acquired twice during held final release (2 rather than
1). Organize apply now reuses shared ESM task, advisory, work/cleanup and lease
owners. Queued start returns actual completion; duplicate run IDs coalesce until
all finalization ends. Terminal close seals admission and observes escaped failures,
including null, through full drainage.

Preview, exclusive-plan preparation, guarded movement and canonical-path/progress/
terminal writes retain their existing owners and awaits. Returned notification and
Activity work now drains under best-effort policy before admitted renewal and
captured lease release. Synchronous throws and plain returns are handled as
best-effort adapters instead of failing already persisted movement. Release is
attempted after renewal drain failure, preserving escaped work Error/null over
cleanup fallout. Unexpected acquisition errors become observable; empty/unavailable
acquisition, stale lease, refused marks, pause/cancellation and partial-move outcome
policies remain. Null domain failure uses a fixed fallback message.

Notifications remain eligible only after the existing terminal mark succeeds and
at least one move is recorded, including partial movement. Failed/not-attempted
remainders and result breakdowns remain intact. Required guarded mutation and
persistence are not demoted to diagnostics. No filesystem, SQL authority, path
containment, overwrite, locking, rollback or retry protocol is rewritten.

Application selection captures execution/inspection/transcode/apply/organize/scan
before awaiting. Startup and both app fixtures preserve receivers, attempt every
known owner after failures and retain original Error/null before pool/environment/
workspace disposal. Apply has a scan-producing handoff; organize notification
wiring does not launch scan directly. Other order is conservative. Returned local
callback completion does not certify remote notification delivery or hidden work.

## Validation and efficiency evidence

- Controlled red retains duplicate acquisition 2 versus 1, then passes with full
  completion ownership.
- Final focused group: **172/172**, zero failures/cancellations/skips. Includes
  mutation/preview/filesystem services, callback policy and partial results, lease
  fencing, failure precedence, startup, ordered owners and prior six-owner consumers.
- Organize unit consumers and the native guarded-mutation helper now await actual
  completion. Four fixed 100 ms waits were removed without weakening assertions.
  This removes fixed padding in those tests; it is not a matched full-suite speedup.
- Complete **npm run validate:fast** passed: copyright, migration/schema, ESM,
  image/Compose checks, lint/test hygiene, **9,690 tests** (4,754 server, 4,384
  client, 552 scripts), zero failures/cancellations/skips and both builds.
  Wrapper duration is 128.25 seconds.
- Affected native group passed **43/43 across ten files**, zero failures/
  cancellations/skips, 137.24 seconds native TAP / 137.37 seconds wrapper.
  Includes guarded real movement, replacement/expiry/CAS/row-lock authority,
  source retention on collision/verification failure, both app fixtures and
  existing execution/inspection/transcode/apply/scan/dispatcher consumers.
- During final review the new native fixture was tightened: assertions inside
  best-effort callbacks can be swallowed. Parent-visible callback-finished and
  release-started checkpoints now prove the intended ordering. Only that native
  fixture changed after the broader gates; production and other test source hashes
  are unchanged. Scoped lint and its four-case suite are rerun against the final
  checkpoint variant: **4/4**, zero failures/cancellations/skips, 9.86 seconds
  native TAP / 9.98 seconds wrapper. Those cases are repeats, not additional
  unique coverage. The prior broad gates and final fixture rerun remain separate
  records; no unchanged runtime or unrelated gate was repeated for this test-only
  strengthening. Intentional scenario-null cases produce expected failure-probe
  rows; they are not failed tests or diagnoses of historical infrastructure errors.
- Scoped lint and npm audit passed; zero reported vulnerabilities. Source and
  installed standards plus the testing skill pass three structural validators,
  and all four installed standards files match source hashes. This is narrow
  reference maintenance, not a new blind skill trial or security certification.

Versions were read locally: Node 24.18.1, npm 12.0.2, pg 8.23.0, pg-pool 3.14.0
and Testcontainers PostgreSQL 12.1.0. The existing media image supplied to the
broader native wrapper was verified as
sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2.
Supplying that environment does not certify tooling use in every case. The wrapper
restores its prior value in finally; the final organize-only rerun needs no media
tools. Fast and broad-native wrappers overlapped; spans are not additive or matched
performance evidence. No image or deployment was rebuilt.

Commands at the repository root:

```powershell
node --test --test-reporter=tap test/server/organize-apply-worker-lifetime.test.js test/server/library-organize-apply-worker.test.js test/server/library-organize-mutation-service.test.js test/server/library-organize-preview-service.test.js test/server/library-organize-apply-service.test.js test/server/media-filesystem-service.test.js test/server/notification-callback-wiring.test.js test/server/app-worker-lifecycle.test.js test/server/startup-runtime.test.js test/server/operation-queue-handlers.test.js test/server/worker-owner-drain.test.js test/server/import-candidate-apply-worker-lifetime.test.js test/server/library-scan-worker-lifetime.test.js test/server/import-execution-worker-lifetime.test.js test/server/media-inspection-worker-lifetime.test.js test/server/transcode-worker-lifetime.test.js
npm run validate:fast
$env:HARMONIARR_INTEGRATION_MEDIA_IMAGE = 'sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2'
node --test --test-concurrency=1 --test-reporter=tap test/integration/organize-apply-worker-lifetime.test.js test/integration/library-organize-mutation.test.js test/integration/transcode-worker-lifetime.test.js test/integration/media-inspection-worker-lifetime.test.js test/integration/import-review-operations.test.js test/integration/import-apply-post-apply-scan.test.js test/integration/import-execution-worker-lifetime.test.js test/integration/apply-worker-lifetime.test.js test/integration/library-scan-worker-lifetime.test.js test/integration/operation-dispatcher-lifetime.test.js
node --test --test-concurrency=1 --test-reporter=tap test/integration/organize-apply-worker-lifetime.test.js
npm run validate:security:npm
```

Private evidence stays in .tmp/organize-apply-lifetime-2026-10-11/: original
worker/test snapshots, red/green/focused/native/fast logs, both source freezes,
fixture-checkpoint diff, final candidate patch, MCP sources/PR scopes and results.
Original deadlines/assertions remain; no case was skipped or expectation weakened.

## Recommendation and next work

Stack: durable queue/captured lease authority; guarded exclusive verified file
movement; modular ESM completion and advisory owners; renewal-before-release
finalizers; ordered captured application owners; native pool lifetime; focused and
affected filesystem/PostgreSQL validation. Benefit: prevents known duplicate
execution and teardown during organize finalization. Cost: cooperative closure
waits for dependencies and hidden/remote work still needs its own contract.

Next: own library-discovery dispatch completion, returned reconciliation/artwork/
provider work, lease finalizers and ledger pruning. Its active marker is removed
before release at src/server/library/library-discovery-worker.js:191 and queued
launch remains detached. Trace scoped recovery and downstream authority before
choosing order. Then remaining workers/periodic producers before deleting residual
waits or promoting exhaustive scheduling changes. Historical SQL-reset causes
remain unconfirmed.

This is affected coverage, not exhaustive native validation, global filesystem/SQL
atomicity, complete app quiescence, remote delivery or whole-system security/WCAG
certification. No route, schema, dependency, branch, release, remote PR merge or
deployment rebuild changes are included. Timing observations are separate spans.
