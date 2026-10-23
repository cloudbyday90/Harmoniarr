# Candidate reputation publication design

Date: 2026-10-23. Scope: the five non-spectral outcome producers identified after spectral reputation publication.

## Producer inventory and identity

| Producer | Evidence | Durable identity and replay guard |
| --- | --- | --- |
| Candidate applied | Success, delivered quality | Candidate event UUID; status compare-and-set from import_pending |
| Candidate download failed | Failure | Candidate event UUID; status compare-and-set from selected/downloading |
| Candidate quality failed | Failure, zero default quality weight | Candidate event UUID; status compare-and-set from import_pending |
| Candidate import blocked | Failure only for unavailable source | Candidate event UUID; status compare-and-set from import_pending |
| Music Queue recovery | Terminal failure except environmental/operator blockers and scheduled same-candidate rejection retry | Terminal candidate event UUID; locked source-run/candidate episode |

A candidate UUID alone would conflate genuine later attempts. The event UUID belongs to one accepted observation. Mint publication authority only after its guarded mutation and event insert. Use that same UUID for ledger and trust history. Duplicate ledger identity fails the whole transaction; do not interpret a conflicting payload as successful replay. Producer guards own replay, including after ledger retention removes old events. Existing anonymous historical evidence cannot be safely reconstructed or deduplicated.

## Transaction and lifetime

Candidate status, candidate event, ledger insert and trust snapshot mutation share one PostgreSQL transaction and connection. Recovery also includes episode, attempts, selected replacement, child run and audit. Explicit READ COMMITTED precedes reads. Producer locks precede the existing shared trust snapshot advisory lock; the snapshot read occurs after admission. No nested checkout, savepoint suppression, new migration, service or outbox is needed.

The strict candidate publication adapter passes a per-invocation expiring database capability bound to the event UUID. A raw pool/client, expired facade or foreign event is not authority. This is internal application discipline, not a sandbox against trusted JavaScript. Ledger refusal or missing publication acknowledgement rolls back the producer. Returned advisory notifications run after commit and may fail without changing durable success. They are not durable/exactly-once delivery.

SQL cannot undo already completed filesystem copies or remote downloads. Their existing recovery/receipt guards remain responsible for reconciliation; rolling back a database transition must not imply those external effects disappeared. Standalone in-memory service injection remains useful for projection tests; canonical producer paths require transaction-capable persistence and a recorded acknowledgement.

## Validation plan

Reproduce canonical ledger refusal before editing. Exercise all four transitions, recovery replay and concurrent observations, genuine later attempts, duplicate identities, actual SQL ledger/snapshot failures, Error/null propagation and capability expiry. Hold real publication before commit and inspect from another connection; after commit evidence must already exist before any advisory. Include existing spectral cross-writer and recovery transaction cohorts, one full fast gate and packaged PostgreSQL. Rebuild Docker without cache using all five preserved live mounts. Keep unrelated allocation qualifications when exact runtime comparisons prove those components unchanged.

## Next candidate

The [outcome](CANDIDATE_REPUTATION_OUTCOME.md) prioritizes the now-observed controlled-provider fixture authority gap. After that qualification is repaired, measure the full-snapshot rewrite under realistic source counts before replacing it with per-source normalized rows. Keep manual trust/block decisions and snapshot restore semantics explicit in that design.
