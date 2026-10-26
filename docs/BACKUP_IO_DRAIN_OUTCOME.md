# Backup I/O drainage outcome

October 25, 2026. See [design and tradeoffs](BACKUP_IO_DRAIN_DESIGN.md),
[official-source research](BACKUP_IO_DRAIN_RESEARCH.md) and
[Docker outcome](LOCAL_DOCKER_BACKUP_IO_DRAIN_OUTCOME.md).

## Result

Production backup facades now share synchronous local admission before database
checkout. Local ownership remains held through the entire returned operation,
including admitted file work and database-client cleanup. Losing the PostgreSQL
session does not free this local owner. Publish/delete contenders receive the
existing fixed conflict; recovery returns explicit ownership busy without
inventing outcome counts. Contenders are refused rather than queued.

The small ESM coordinator is separate from SQL ownership and workflow policy.
Factories remain injectable; default production instances use one canonical module
instance. PostgreSQL still owns cooperative healthy-session serialization and
the pinned journal/catalog client. No second process/service, dependency, schema,
version, branch or release is added.

## Reproduction and validation

A controlled baseline fixture held the production file service's injected unlink
wrapper after admission, terminated the actual backend and observed its retirement.
Fresh recovery completed deletion and published a replacement at the same path.
The old wrapper then called actual `unlink`, removing replacement bytes while
the replacement catalog row remained. This proves the service-admission race;
it is not evidence of a real kernel stall or a reported production incident.

All 31 focused tests pass. The new coordinator tests synchronous refusal, no
second checkout, shared default ownership across facade instances, delayed
session cleanup, preservation of the wrapped Error/null and reuse after settlement.

All fast-gate stages pass on the frozen source: 6,035 server, 4,485 client and
700 script tests, with zero failures, skips or cancellations. Lint, baseline,
migration, schema, ESM, image/topology, hygiene checks and build pass. The server
suite used `node --test --test-concurrency=8 "test/server/**/*.test.js"` and took
about 70 seconds. This is a bounded equivalent invocation, not execution of the
unchanged `npm run validate:fast` command or a general CI performance benchmark.

Final native drainage, publication and journal entries pass in separate guarded,
networkless, read-only containers with disposable PostgreSQL (3 GiB/two CPUs).
Read-only source mounts match independently inventoried packaged module bytes.
The drainage entry exercises admitted final unlink, link and temporary cleanup.
Each actual backend and advisory lock retires while the file wrapper remains
held. Default app recovery/publish/delete contenders stay busy without journal
changes. After the returned file work settles, the lost owner cannot advance
metadata; fresh recovery completes once. Replacement/final bytes and one catalog
row remain. Actual PostgreSQL contention is also checked independently of the
local gate. Publication and journal regressions retain collision, one-client-pool,
identity, phase and bounded-error coverage.

A disposable packaged file-service probe on the live configured backup root passes
exclusive linking, inode cleanup, collision preservation and mode `0600`. Its
directory is removed. This is storage capability proof, not a full live backup or
restore. Builders, bootstrap, inventory/identity and native helpers are retired.

Exact source/test and packaged-runtime comparison retains 44 unrelated native
entries, 42 SQL checks, eleven recent and nine earlier review browser checks, plus
controlled-provider/file-backed evidence. These are retained proofs, not new
executions. Unchanged codec allocation and broad SQL/browser matrices were not
repeated. Frozen source: 3,534 files,
`5d5db809577f42806b8e21ffae12b2134a91bfe8d0aae2c92d0c6e8e850d7cf9`.
Private baseline/final logs, manifests and audit are under
`.tmp/backup-io-drain-2026-10-25/`.

GitHub MCP found no open PRs for `cloudbyday90/Harmoniarr` on the initial and final
checks. There was no PR to apply, rebase, close or merge. Work stays on `main`.

## Recommendation stack and limits

Adopt shared local admission → pinned PostgreSQL session ownership → existing
journal/exclusive publication/verification/cleanup → awaited session cleanup →
local release and fresh recovery. Benefits: constant coordinator state, refusal
without another checkout, and no local successor before returned work settles.
Costs: serial backup work, indefinite busy status if work never settles, and local
process scope. The design document compares the alternatives.

The packaged app has one application process. Independent processes, worker
isolates and distinct ESM URLs do not share this gate. Healthy PostgreSQL sessions
remain coordinated, but loss of one session is not distributed fencing. Process
crash, power loss, unreturned work and arbitrary same-UID pathname replacement
remain outside this qualification. W3C guidance informs truthful busy/completed
outcomes; no UI or manual screen-reader/device acceptance claim is added.

## Next recommended item

Preserve the primary file-operation failure when failure journaling is itself
refused. A separate controlled core-service probe found that an original `EIO`
or thrown null is replaced by `backup_artifact_owner_lost` when the awaited
`recordFileOperationFailure` call throws that secondary error. This is diagnostic
error precedence, distinct from the native successful-I/O-after-loss cases above.
The local gate preserves its wrapped outcome; it does not rewrite lower-layer
failure selection. Start with a focused primary/secondary failure matrix, retain
safe phase/error fields and expose secondary recording failure without masking
the original failure. The private probe and finding are retained with this outcome.

Before adding independent application writers, separately qualify conservative
durable uncertain-I/O admission and operator recovery. Do not extend this local
protocol's guarantee merely by increasing Compose replicas or adding workers.
