# Operator artist reconciliation lifetime outcome

Implemented and validated October 12, 2026 on main, following the separate
[design](OPERATOR_ARTIST_RECONCILIATION_LIFETIME_DESIGN.md) and
[official research](OPERATOR_ARTIST_RECONCILIATION_LIFETIME_RESEARCH_2026_10.md).

## Delivered behavior

Queued start returns actual completion; canonical terminal close seals admission
and drains admitted execution, status persistence, heartbeat renewal and captured
lease release. Duplicate IDs share completion through release. Unexpected
acquisition Error/null remains observable without unowned writes; expected empty/
unavailable/lost acquisition, lost acquired authority, pause/cancellation and
refused marks retain their existing domain policy. Null domain failure receives
a fixed message. Escaped work failure wins over cleanup, including null, and
release is attempted after renewal-drain failure.

A small ESM parallel-task helper owns returned callbacks through every sibling
settlement, preserving first observed failure and ordered successful values.
Both reconciliation read batches use it, as do their traced artist-payload,
monitoring and snapshot-by-ID read batches. Concurrency is retained. Other read/
save paths and hidden detached work are outside this ownership claim. The
callback batch does not supply one consistent SQL snapshot or transactional
publication authority.

Accepted actor/artist/snapshot IDs, revision, trigger, cancellation hook, complete
result summary and expected-lease status/release remain intact. Request identity
locks, per-release transactions, duplicate checks, required request events,
commit/rollback and returned discovery reconciliation keep their existing
behavior. No new remote retry, forced abort, route, schema or policy rewrite.

Application drainage captures twelve concrete owners before awaiting any: metadata
refresh, artist reconciliation, then the ten existing library/import owners.
Every known owner is attempted after failure with first Error/null retained.
Startup already forwards metadataModule; its test now holds reconciliation before
following workers and pool close. Both application fixtures use the same adapter.

## Executed evidence

Two retained original-source regressions fail as expected: duplicate held-release
admission acquires twice (`2 !== 1`), and a fail-fast input batch settles while its
snapshot sibling is held (`true !== false`). Fifteen JavaScript files were frozen
before complete gates. No JavaScript changed after these passing gates.

| Validation | Result |
| --- | --- |
| Focused `node --test --test-concurrency=4 --test-reporter=tap`, 28 verified literal files | 264/264, zero failures/cancellations/skips |
| `npm run validate:fast` | 9,824/9,824: 4,888 server, 4,384 client, 552 scripts; zero failures/cancellations/skips; both builds pass |
| Affected `node --test --test-concurrency=1 --test-reporter=tap`, 13 verified native files | 60/60, six suites plus standalone tests; zero failures/cancellations/skips |
| Scoped ESLint and complete fast static/schema/migration/ESM/image/compose/copyright/hygiene checks | Pass |
| `npm run validate:security:npm` | Zero reported vulnerabilities |
| Standards source/installed and testing skill quick validation | All three pass; four installed standards files match source SHA256 |

Focused coverage includes worker/execution/request/snapshot/run/recovery,
monitoring/desired state/selections/overrides, metadata refresh/routes/module,
lease/heartbeat/task/owner, handler/dispatcher, app and startup. Earlier worker,
read and app feedback are subsets, not extra unique tests.

Native selection: operator-artist-reconciliation-worker-lifetime,
operator-artist-reconciliation-recovery, operator-artist-save-revision,
operator-artist-transactional-activity, operator-artist-post-save-failure,
operator-artist-projection-read-only, operator-artist-summary-inputs,
metadata-refresh-worker-lifetime, library-wanted-release-reconciliation,
library-release-reconciliation, discovery-worker-lifetime,
operation-dispatcher-lifetime and database-pool-lifecycle. The stable group ran
once, without a separate new-file-only native probe or an exhaustive native run.

Four new cases cover functional/reusable app fixtures, each with success and
scenario-null plus release-Error precedence. They run actual metadata/monitoring/
snapshot/queue/lease stores, execution/desired-state/request services, request and
required event transactions, and discovery service/store. Held snapshot read,
uncommitted event, committed request before discovery, and completed status before
release keep the owned pool, database environment and workspace alive. Parent
checks establish matching actor/recipient/release/snapshot evidence, one event
and real discovery publication, then restored environment and removed workspace.
Four additional native cases establish foreign actor snapshot refusal, revision
mismatch, saved cancellation and rollback after an inserted required event throws
null. No downstream request/event remains on these paths. These cases own their
worker explicitly before fixture teardown.

Observed host packages: Node 24.18.1, npm 12.0.2, pg 8.23.0, pg-pool 3.14.0 and
@testcontainers/postgresql 12.1.0. The existing scoped/restored media image was
inspected as `harmoniarr-quality-fallback:local`, immutable ID
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`.
Final network-disabled tool inspection reports ffmpeg/ffprobe 8.0.1.
Configuration does not imply every selected case exercised media tooling.
Expected controlled scenario-null diagnostics are retained with original logs.

Observed durations: focused TAP 2.99 seconds (wrapper 3.12), fast wrapper 180.04
seconds including client build 4.89 seconds, native TAP 223.81 seconds (wrapper
223.93). Fast and
native overlapped; durations are neither additive nor matched speedup evidence.
Raw logs, wrapper durations and literal selection manifests are retained privately.

## Recommendation stack and limits

Select captured actor/artist/snapshot → drained current input reads → existing
request/event transaction → returned discovery reconciliation → status/renewal/
captured lease finalization → application drain. Benefit: deterministic disposal
with concurrent reads and exact failures. Cost: waiting for admitted dependencies;
force-abort and hidden detached work need separate contracts.

Next: design and implement mutation-time snapshot/current-policy/lease fencing
in request materialization, preserving save-lock order, duplicate suppression,
required events and per-release atomicity. Scoped snapshot/revision reads are
already tested, but complete policy and worker lease are not revalidated under
that write transaction. Lifetime completion does not fill that gap. Then continue
remaining artwork/notification/periodic ownership before removing the residual
150ms app-fixture wait. Historical SQL-reset causes remain unconfirmed.

The [PR applicability outcome](OPEN_PR_APPLICABILITY_OPERATOR_RECONCILIATION_LIFETIME_2026_10_OUTCOME.md)
records the unchanged final two-page MCP refresh: no eligible unreplayed patch.
Documentation and practical standards/testing skill references are updated; this
is reference maintenance with structural/hash evidence, without a new blind trial
or security/WCAG/conformance certification. Publication stays main only with no
release, tag or PR merge.
