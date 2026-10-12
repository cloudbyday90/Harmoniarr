# Operator reconciliation publication authority outcome

Implemented and validated October 12, 2026 on main, following the separate
[design](OPERATOR_RECONCILIATION_PUBLICATION_AUTHORITY_DESIGN.md) and
[official research](OPERATOR_RECONCILIATION_PUBLICATION_AUTHORITY_RESEARCH_2026_10.md).

## Delivered behavior

Worker execution captures exact acquisition before awaits, then owns normalized
policy, nullable selections/overrides, catalog, snapshot payload and plan inputs.
Later caller mutation cannot retarget that plan. Catalog query order is retained
for per-release progress; only read-view refresh timestamps and selection/override
ordering are normalized. Publication defaults to refusal when authority is absent
or invalid; there is no implicit unfenced direct mode.

Each eligible request uses the existing sequential transaction runner. Ordered
locks cover canonical artist-save scope, run, lease key/row, existing actor/policy/
snapshot/catalog rows and request identity. Current running scoped summary, exact
acquisition, enabled actor, latest scoped snapshot and original policy/catalog/
target are checked after admission, after identity contention before creation,
and after the required event before commit. Lease expiry uses a fresh database
clock after source reads. Refusal rolls back the current request and event.

Cancellation and maintenance rechecks forward that same transaction queryable
through already-supported worker/interruption/store adapters. They do not request
another pool connection while holding publication locks. Per-release atomicity,
duplicate suppression, explicit versus automated selection semantics, existing
pause/cancellation/lost-lease handling and original summary fields remain.
Earlier committed requests survive a later refusal and their discovery work is
reconciled after the request client returns. Duplicate transactions commit no
domain writes. No route, schema, provider replay, force-abort or release change.

The shared runner now converts non-Error rollback failures into a fixed Error
with the original rollback cause, so a falsey reason cannot reuse an uncertain
client. It preserves the original work Error/null and existing rollback Error
identity. Native evidence waits for the discarded client's end, not only release
acknowledgement, and verifies rollback on another connection.

## Executed evidence and retained corrections

The original request publisher reproduced stale publication after a canonical
newer save: one request remained (`1 !== 0`), expected regression 0/1. Source and
raw log are retained privately. The final implementation refuses that plan and
retains the newly queued snapshot follow-up.

An initial native attempt was deliberately stopped after source review found
that immediate production heartbeat renewal overrides the fixture's short lease
with its ordinary 30-minute duration. Only the verified owned Node process tree
was terminated; root PID/creation/command evidence and incomplete logs remain.
The controlled expiry case disables its injected renewal adapter and awaits the
real SQL clock on its owned client after request/event insertion. Production
renewal and all test/production deadlines remain unchanged.

The next affected run completed 74/76 with two failures: the contention observer
requested a third client while publication and save occupied the two-client
application pool, and concurrent publishers exposed the production cancellation
hook's equivalent extra checkout. The resulting missing combined result was
secondary to that checkout failure. The correction forwards the owned transaction
queryable and gives the observer an independent client from acknowledged fixture
connection config. Both failing cases then pass 2/2 under the same app pool bound.
The complete fast and affected native gates were rerun for the corrected code.
No deadline, assertion, skip or application pool capacity was weakened.

| Final validation | Result |
| --- | --- |
| Focused `node --test --test-concurrency=4 --test-reporter=tap`, 34 verified literal files | 329/329; zero failures/cancellations/skips |
| `npm run validate:fast` | 9,852/9,852: 4,916 server, 4,384 client, 552 scripts; zero failures/cancellations/skips; both builds pass |
| Affected `node --test --test-concurrency=1 --test-reporter=tap`, 14 verified native files | 76/76; seven suites plus standalone tests; zero failures/cancellations/skips |
| Scoped ESLint and complete fast static/schema/migration/ESM/image/compose/copyright/hygiene checks | Pass |
| `npm run validate:security:npm` | Zero reported vulnerabilities |
| Standards source/installed and testing skill quick validation | Three pass; four installed standards files match source SHA256 |

Native selection includes the new publication-authority file and the thirteen
prior affected reconciliation-lifetime/recovery, artist-save revision/Activity/
post-save/projection/summary, metadata-refresh, wanted/release-reconciliation,
discovery, dispatcher and pool-lifecycle files. Literal manifests and exact
commands are retained with raw logs. Focused selection additionally covers
transaction/cancellation/run/maintenance adapters and metadata consumers. Earlier
feedback and the two-case correction are subsets, not extra unique coverage.

Sixteen new native cases cover changed canonical save, monitoring, selection,
override, catalog, acquisition, expiry, cancellation, disabled actor and run
scope; expiry after both insertions; original event-null rollback; earlier durable
progress plus discovery after a later stale release; observed save contention;
duplicate concurrency; and native client eviction after null rollback failure.
Existing functional/reusable fixture lifetime cases also pass with the guards.

Fifteen JavaScript files were frozen for the final complete gates. Working/index
hashes are compared before publication; no JavaScript changed afterward. All
stopped/failed candidates and the earlier passing fast run are retained separately.
Final focused TAP duration is 2.41 seconds (wrapper 2.49), fast wrapper 126.18
seconds including client build 1.85 seconds, native TAP 163.25 seconds. Gates
overlapped; these are not additive or matched performance measurements.

Observed packages: Node 24.18.1, npm 12.0.2, pg 8.23.0, pg-pool 3.14.0 and
@testcontainers/postgresql 12.1.0; native diagnostics report PostgreSQL 18.3.
Existing media image `harmoniarr-quality-fallback:local` was inspected and scoped/
restored, ID `sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`,
with network-disabled ffmpeg/ffprobe 8.0.1 checks. Configuration does not imply
every selected case exercised media tools.

## Final recommendation and next item

Select captured intent/source → save/run/lease locks → current source/target
verification → identity lock/deduplication → request/event → final SQL authority
and clock check → commit → discovery and worker drainage. Benefit: stale refusal
and atomic publication without third-checkout self-starvation. Tradeoff: extra
source queries/checkouts, lock waits and intentionally preserved partial progress.

Next coordinate standalone policy/snapshot helpers and catalog writers with this
protocol, auditing inserted/absent rows and lock order before claiming broader
source stability. Canonical production saves participate; existing-row locks and
rechecks do not establish a globally frozen catalog or fence all privileged raw
SQL/phantom writers. Current availability/global discovery ownership also remains
at its existing owners. Preserve explicit consent and acquisition semantics while
broadening those guarantees. Historical unrelated SQL-reset causes stay unconfirmed.

The [PR applicability outcome](OPEN_PR_APPLICABILITY_RECONCILIATION_AUTHORITY_2026_10_OUTCOME.md)
records the unchanged final two-page MCP refresh: no eligible unreplayed patch.
Relevant docs and the practical standards/testing skill are maintained. This is
structural/hash-validated reference maintenance, without a new blind trial or
security/WCAG/conformance certification. Publication remains main only, without
release, tag or PR merge.
