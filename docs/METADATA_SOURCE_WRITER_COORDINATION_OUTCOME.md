# Metadata source writer coordination outcome

Implemented and validated October 12, 2026 on main, following the separate
[design](METADATA_SOURCE_WRITER_COORDINATION_DESIGN.md) and
[official research](METADATA_SOURCE_WRITER_COORDINATION_RESEARCH_2026_10.md).

## Delivered behavior

Supported source writers now participate in transaction-level admission before
scopes and source rows. The save-state entrypoint acquires shared admission before
its UUID-canonicalized scope, covering canonical save, queue/recovery and request
publication callers. Scoped monitoring/snapshot/selection/override writes share
admission and lock their actor/artist scope, including when a row does not yet
exist. Catalog and bulk snapshot writes acquire exclusive admission at entry.
Transaction completion releases locks without session locks or manual unlocks.

A narrow ESM write service owns or borrows one active transaction client. An
autocommit queryable refuses before mutation; borrowed callers retain commit/
rollback/release ownership. Owned work reuses the existing runner, retaining
original Error/null and uncertain-client eviction. Monitoring arrays, replacement
rows, snapshot JSON and catalog DTOs are captured before admission can wait.
Nullable fields and the existing default snapshot container remain intact.

Both metadata service composition and exported artist/group/release upserts are
enrolled. Canonical selection reads and clearing/setting now occur in one
exclusive admitted transaction; failed setting restores the previous winner.
Automatic ranking, explicit canonical choice, source data shape, per-snapshot
restore boundaries and per-release request/event atomicity remain unchanged.
Provider work and post-commit follow-ups stay outside admitted SQL transactions.
Ordinary reads and policy writes in different scopes can still progress.

## Executed evidence and corrections

An original-source standalone selection writer completed its insert while a real
publication was held after the final authority check. The expected-blocking
regression failed with `fixture_operation_completed_before_ready` (0/1), retained
with the original writer and raw log. The enrolled writer blocks until the
publication request/event transaction commits. This demonstrates the old API's
missing participation, not a claim that advisory locks constrain arbitrary SQL.

Initial store feedback exposed transactionless doubles and positional assertions
that no longer represented mutation boundaries (27/40). Updated doubles retain
every statement and provide owned clients; SQL-shape assertions select domain
statements while transaction/admission behavior has separate tests. Corrected
feedback is 40/40. A scoped lint pass also identified an unused early snapshot
serialization; it was corrected before source freeze. No assertion was dropped.

The first complete affected native group finished 102/104. Two legacy fixtures
passed a pool as a borrowed transaction: one direct artist upsert in release
reconciliation and one track override during summary seeding. Both correctly
refused with PostgreSQL `25P01`. The artist fixture now borrows its existing
transaction runner's client; the override fixture lets the store own its
transaction. Both cases pass 2/2 separately, then the complete group passes.
Autocommit refusal, assertions, deadlines, skips and application pool bounds
remain intact. Production and unit-test hashes from the first candidate are
unchanged; only those two fixture adapters changed afterward. Scoped fixture
lint and complete test hygiene were rerun; repeating the passing fast gate was
unnecessary for this native-only correction. All candidate/correction logs remain.

| Final validation | Result |
| --- | --- |
| Focused `node --test --test-concurrency=4 --test-reporter=tap`, 61 verified literal files | 355/355; zero failures/cancellations/skips |
| `npm run validate:fast` | 9,864/9,864: 4,928 server, 4,384 client, 552 scripts; zero failures/cancellations/skips; both builds pass |
| Affected `node --test --test-concurrency=1 --test-reporter=tap`, 19 verified native files | 104/104; nine suites plus standalone tests; zero failures/cancellations/skips |
| Scoped ESLint, corrected fixture lint/hygiene, complete fast static/schema/migration/ESM/image/compose/copyright checks | Pass |
| `npm run validate:security:npm` | Zero reported vulnerabilities |
| Standards source/installed and testing skill quick validation | All three pass; four installed standards files match source SHA256 |

Seventeen new native cases cover thirteen writer families: selection/override
upsert and replacement, snapshot allocation, monitoring, group/release insertion,
metadata graph, canonical change and three bulk snapshots. They hold publication
after the final check, observe actual blocked backends through an independent
owned-config client, retain ordinary read access, then commit and drain both
operations. Additional cases establish another operator scope's progress,
autocommit refusal, caller-owned rollback and restoration of the original
canonical winner after a null setting failure. Previous publication/lifetime,
save/recovery/Activity, metadata read/refresh, override-validation, library
catalogue/wanted/release, discovery, dispatcher and pool-lifecycle consumers pass.

Native literal selection: metadata-source-writer-coordination,
operator-artist-reconciliation-worker-lifetime, operator-artist-reconciliation-recovery,
operator-reconciliation-publication-authority, operator-artist-save-revision,
operator-artist-transactional-activity, operator-artist-post-save-failure,
operator-artist-projection-read-only, operator-artist-summary-inputs,
metadata-refresh-worker-lifetime, library-wanted-release-reconciliation,
library-release-reconciliation, discovery-worker-lifetime, operation-dispatcher-lifetime,
database-pool-lifecycle, metadata-artist-summary-read, metadata-artist-discography-page,
operator-track-override-validation and library-scan-catalogue. Earlier feedback
and the two-case correction are subsets, not extra unique coverage.

Nineteen JavaScript files were frozen before complete gates; the final freeze
contains those unchanged files plus the two corrected native fixtures. Working/
index hashes are checked before publication. No production JavaScript changed
after complete gates. The stable native group was run once after correction,
without a separate new-file-only native probe or exhaustive native gate.

Observed packages: Node 24.18.1, npm 12.0.2, pg 8.23.0, pg-pool 3.14.0 and
@testcontainers/postgresql 12.1.0; native diagnostics report PostgreSQL 18.3.
The existing scoped/restored media image was inspected as
`harmoniarr-quality-fallback:local`, ID
`sha256:f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`,
with network-disabled ffmpeg/ffprobe 8.0.1 checks. Configuration does not mean
every selected case exercised media tooling.

Observed durations: final focused TAP 5.87 seconds (wrapper 5.97), fast wrapper
171.87 seconds including client build 3.38 seconds, first failed native TAP
315.22 seconds and final native TAP 244.53 seconds (wrapper 244.65). Independent
gates overlapped and candidates differ; these are not additive or matched
performance comparisons. Raw logs and exact literal command manifests are retained.

## Recommendation stack, limits and next item

Select owned/borrowed transaction → shared/exclusive admission → scope/run/lease
→ current source/target checks → atomic request/event → final SQL clock → commit
→ returned discovery and worker drainage. Benefits are supported missing-row
coordination and atomic canonical selection. Cost: catalog/bulk transactions
serialize globally and can delay admitted work. Mixed transactions must choose
exclusive admission before shared/scoped work. Privileged raw SQL, migrations,
external tools and custom late-upgrade callbacks do not acquire this protocol
automatically. Other projection readers retain their existing owners; global
source stability, full authorization and W3C/WCAG conformance are not claimed.

Next: gate policy-only automation when an artist is unmonitored while preserving
explicit release/track consent. Source review plus a direct planner probe returns
one eligible policy release with `isMonitored: false`; this is planner-level
evidence, not a full-flow reproduction. Verify the saved opt-out through native
queue/materialization consumers before changing planner and downstream behavior.
Projection-reader enrollment and per-artist catalog partitioning remain later
coordination work. Historical unrelated SQL-reset causes stay unconfirmed.

The [PR applicability outcome](OPEN_PR_APPLICABILITY_METADATA_SOURCE_WRITERS_2026_10_OUTCOME.md)
records the unchanged final two-page MCP refresh: no eligible unreplayed revision.
Docs and practical standards/testing skill references are maintained with
structural/hash evidence, without a new blind skill trial or broad certification.
Publication stays main only, with no release, tag or PR merge.
