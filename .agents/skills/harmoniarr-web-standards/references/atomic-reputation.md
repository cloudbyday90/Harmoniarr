# Durable spectral reputation

Use for spectral outcome identity, ledger/snapshot publication or trust snapshot
mutation. Read the [design](../../../../docs/SPECTRAL_REPUTATION_DESIGN.md) and
[research](../../../../docs/SPECTRAL_REPUTATION_RESEARCH.md).

Inventory durable destinations before prescribing an outbox. Spectral cache,
job, outcome ledger and trust snapshot share PostgreSQL: they commit in one
captured-claim transaction. The job UUID is the event primary key and history
identity. A retry after rollback has no partial penalty; a completed claim refuses
replay. A conflicting event key refuses the transaction rather than incrementing
the snapshot anyway. Do not replay old completed jobs without proving whether
their earlier anonymous event already exists.

Only the current invocation's scoped publication queryable may record strict
spectral evidence. Native pool/client identity alone is insufficient. Check job
ownership, propagate the same scope and refuse retained scopes after their callback
ends, including native-client reuse. These are internal composition capabilities,
not protection against arbitrary trusted JavaScript importing the minting helper.

All canonical trust read/modify/replace writers acquire snapshot admission before
reading: ordinary outcome, override, block and unblock. Full snapshot replacement
uses the same lock; it still intentionally replaces data. READ COMMITTED is explicit
before data access. Lock order is spectral row then snapshot admission; snapshot
writers do not acquire spectral rows. Keep native work and advisories outside.
The whole-snapshot rewrite remains a scaling cost, and nonparticipating writers
remain outside this cooperating application contract.

Strict spectral ledger/snapshot failures must roll back cache and completion too.
Non-spectral producers now use [candidate publication](candidate-reputation.md):
the guarded candidate event UUID, producer transaction and returned advisory.
Ledger refusal rolls back their producer state and counters. The original spectral
round left this work outstanding; its historical outcome records that baseline.

Run notification/auto-ignore callbacks after successful commit. Await their returned
work in spectral and candidate processing. An abort after
commit cannot undo the penalty, and advisory failure is not durable-write failure.
Do not claim exactly-once notifications or ownership of hidden descendants.

Prove actual process exit before and after commit, every durable-write refusal,
Error/null cancellation, duplicate identity, concurrent peers and all snapshot
mutation directions with independent lock observation. Assert durable results
outside swallowed advisory adapters. Shared test registration keeps the native
`validate:native-spectral-reputation` lane aligned with isolated PostgreSQL;
its guarded disposable profile must refuse live storage before checkout.
Pair it with app composition and existing admission/interruption tests. Preserve
prior candidate failures and distinguish selected timings from suite performance.

Discover and open official sources through MCP, record source status/date and
project inference, and minimize committed evidence. W3C privacy guidance supports
minimal identifiers and no duplicate payload queue; it does not certify database
atomicity or supply an accessibility acceptance result.
