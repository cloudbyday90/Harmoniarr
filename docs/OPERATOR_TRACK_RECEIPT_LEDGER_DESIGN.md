# Indexed owner receipt ledger

October 12, 2026. Baseline main `e579c47`. The separate research and outcome
documents own consulted sources, measurements and executed evidence.

## Finding and selected slice

`operator-track-acquisition-store.js` currently expands receipt JSON for every
applied candidate before selecting an owner/release. A fresh PostgreSQL fixture
with 10,001 candidates returned one receipt in about 20–27ms per command; the
observed plan touched 2,039 shared blocks. This isolates SQL lookup, not filesystem
hashing or whole Wanted reconciliation, and is synthetic local evidence.

Add a candidate-owned relational projection with an owner/release B-tree index.
Candidate JSON remains the historical source and existing byte/scope checks remain
the authority for current availability. A small ESM receipt store reads the
projection; the existing acquisition store delegates without changing its DTO.

The ledger contains candidate, owner and metadata-release UUID keys plus the
unchanged version-one receipt JSON. Its candidate foreign key cascades deletion;
owner/request/release references inside historical evidence are not rewritten or
made current by backfill. No public endpoint exposes private paths or receipts.
Constraints bind indexed owner/release columns to the retained receipt.

## Publication, upgrade and rollback

A transaction-local candidate trigger maintains the projection when applied
status or fulfillment changes. It does no authorization or domain action. Skip
unrelated payload changes; pending checkpoints cannot become ledger receipts.
Readers never backfill or repair data. This covers existing canonical publication
and direct candidate inserts/updates without a second service write that can drift.
Required-event rejection rolls back candidate state and ledger rows together.

The additive migration locks candidate writes while installing the trigger and
backfilling existing applied receipts. It recognizes version-one receipts and the
supported exact two-receipt envelope, conservatively excluding malformed IDs,
unknown versions, unsupported lengths and duplicate owners. It does not attest
media, change consent, retire sources or dispatch provider work. Startup migration
duration/write blocking must be considered for large histories; this is not an
online zero-lock migration. The generated snapshot and schema anchors include
the new table, binding constraints and lookup index.

## Alternatives and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep full JSON expansion | No schema change | Work grows with unrelated candidate history | Baseline only |
| JSON GIN/expression indexing | Fewer derived records | Different single/two-owner shapes; relational owner/release filtering and lifecycle remain awkward | Defer |
| Service-maintained child rows | Explicit application writes | Every restore/direct writer must dual-write correctly | Reject drift risk here |
| Trigger-maintained historical projection | Indexed exact selection; one transaction with source | Trigger/storage/backfill cost; does not reduce hashing | Implement |
| Scan-owned availability cache | Can reduce repeated media checks | Size/mtime/tombstones are not byte identity; requires ordered scan/apply/organize invalidation | Separate follow-up |

Stack: canonical guarded publication → candidate JSON → atomic derived receipt
rows → indexed owner/release read → unchanged current scope/private-root/hash
verification → existing source lifecycle. This is a project choice informed by
official guidance, not a standards mandate or security certification.

## Scan invalidation boundary

Scans currently record size, modification time and missing-file tombstones.
They do not establish the receipt's SHA-256 identity. This slice deliberately
does not let an observed catalogue row grant fulfillment or let an old scan erase
a new delivery. Retain current byte verification and owner-specific reopening.
Next, define scan-owned negative invalidation with original acquisition authority,
complete root scope, exact path/receipt binding and late-change rechecks before
considering any availability cache.

## Proof

Use native PostgreSQL to prove upgrade/backfill, idempotent migration, malformed
history refusal, transaction/event rollback, status/receipt replacement/deletion,
owner isolation and current applied-row visibility. Measure matched legacy and
indexed reads on the same seeded database without forcing planner choices or
asserting timing thresholds. Preserve the actual apply/recovery/Wanted and scan
native contracts. Verify migration and snapshot bootstrap/anchors, then freeze
source for fast and affected serial validation. Main only; no release or merge.
