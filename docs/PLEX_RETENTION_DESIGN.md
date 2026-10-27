# Automatic Plex callback retention design

October 27, 2026. Abandoned or refused pending Plex flows can outlive their
authentication expiry in encrypted-secret storage. Automatic maintenance now
reclaims eligible pending material without requiring a browser action or adding a
deployed application. Authentication still enforces expiry and single use itself.
See [official research and tradeoffs](PLEX_RETENTION_RESEARCH_2026_10.md).

## Boundaries

| ESM module | Responsibility |
| --- | --- |
| `plex-callback-retention-policy.js` | Namespace pattern, batch/cadence/grace limits and pure eligibility classification |
| `plex-callback-retention-store.js` | Transaction advisory claim, bounded locking read and threshold-checked deletion |
| `plex-callback-retention-service.js` | Maintenance guard, bounded envelope decryption, atomic required audit and private committed scan cursor |
| `plex-callback-maintenance-service.js` | Existing heartbeat-runner lifecycle, single-flight through drainage and permanent shutdown admission closure |
| `system-module.js`, `startup-runtime.js`, `application-worker-drain.js` | Composition, automatic supervisor start and concrete owner drainage before shared pool retirement |

Factories remain injectable. No route, dependency, setting, schema migration,
snapshot or index is added. Read-only schema diagnostics remain separate from
retention writes. The existing runtime warning handler receives a fixed generic
failure message without database/provider secrets.

## One pass

The existing bounded write owner has an eight-second result deadline and local
PostgreSQL lock/statement/transaction deadlines. First apply the existing
maintenance write guard with the same client. Its SHARE table lock stabilizes the
absence of blocking maintenance records through commit, including against a new
restore/maintenance INSERT. An active blocking record refuses the pass. Next try
a fixed transaction advisory lock without waiting; another retention owner returns
a busy result and performs no state deletion.

Read at most 100 records of type `integration_oauth` whose full name is the exact
Plex pending prefix plus a canonical lowercase UUID. The persistent installation
client identifier and other names/types are excluded. Select in `(name,id)` order
after a private cursor, with FOR UPDATE SKIP LOCKED. Return ciphertext only when
its stored length is at most 16 KiB; oversized records carry no ciphertext into
the process. Metadata is not selected or treated as authority.

Observe database wall-clock time once for classification. Under the row locks,
decrypt each bounded envelope and choose:

- Version 1 with a canonical expired ISO expiry: eligible immediately.
- Version 1 with an unexpired canonical expiry: retain, regardless of row age or
  conflicting public metadata.
- Plaintext without a version, invalid JSON, or version 1 with malformed expiry:
  eligible only 24 hours after the later of creation and last update. These cannot
  be accepted by the current browser-bound callback reader.
- Any other explicit version: retain because its semantics are unknown.
- Unreadable/oversized ciphertext or unusable row timestamps: retain. Missing or
  wrong decryption material is not evidence that a flow expired.

No provider calls occur. The same transaction holds selected row ownership until
commit/rollback. Concurrent replacement waits and can publish its new state after
the obsolete record's deletion; retention does not chase the replacement. A
callback already locking a row is skipped. A prepared valid callback keeps its
unexpired row and can later atomically consume it through its existing owner.

Delete only selected eligible IDs with the exact namespace/type and a fresh
database-clock check of each deletion threshold. Any cardinality mismatch refuses
and rolls back the batch. A nonempty deletion requires one
`plex_callback_state_pruned` audit containing inspected/deleted/expired/legacy
counts only, on the same client. No IDs, ciphertext, state URLs, verifier/hash,
PIN, subject or token enters that event or returned summary.

## Progress, failure and lifecycle

There is no unbounded catch-up loop. The private cursor advances only after an
acknowledged commit of a full batch; a short batch resets it for the next sweep.
Retained rows therefore do not permanently occupy the first page. A process
restart also resets the cursor. Skipped/changed/new rows may wait for the next
sweep; a pass is not an exhaustive observation. A statement deadline still bounds
an expensive underlying scan; the row limit is not a physical page bound.

Deletion/audit failure rolls back together. A real commit with lost acknowledgement
can durably delete/audit once while the caller reports unavailable; no automatic
retry occurs within that invocation and the cursor does not advance on refusal.
A subsequent scheduled pass observes current rows and is safe to repeat.

The supervisor starts the existing interval runner, which runs immediately and
then every five minutes. Tick admission stays occupied through the transaction's
actual `drained` promise, even if its result deadline fired earlier. Shutdown
closes future admission, stops the interval and awaits that owner before pool
retirement. Uncertain drainage seals future work and refuses successful shutdown.
Existing background-disable controls also disable this automatic work in isolated
fixtures. No user refresh, new UI or manual operation is required.

Tests must prove classification, bounded progress, required audit, lifecycle and
composition, then real PostgreSQL exclusion, rollback, replacement, active
completion, uncertain commit and actual backend retirement. Exact evidence and
limits belong in the separate [outcome](PLEX_RETENTION_OUTCOME.md).
