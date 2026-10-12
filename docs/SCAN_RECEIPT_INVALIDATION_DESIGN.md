# Scan-owned negative receipt invalidation

October 12, 2026. Baseline main `4e3ee28`. Separate research/outcome documents
own consulted official guidance and executed proof.

## Selected boundaries

Add a server-generated receipt revision and a candidate-owned missing observation.
Capture eligible private, single-file owner receipts before the actual complete
walk. Keep that snapshot behind an in-process opaque capability, bound to the
original scan run, acquisition and canonical root. New receipts or replaced
revisions are outside an older walk's authority.

Publication uses the existing guarded catalogue transaction: scan run/lease,
root, candidate, then receipt locks. Compare the captured revision and unchanged
receipt, resolve the current private root, require absence from the complete walk
and confirm actual ENOENT with contained existing ancestors. Recheck after
required events and before return. Catalogue, negative observation and required
candidate event commit or roll back together. Parent candidate locks precede
receipt locks, matching projection writers and avoiding FK/cascade inversion.

The observation is bound by FK to the exact revision; replacement/deletion removes
obsolete negative evidence. It records no positive availability and never erases
the historical JSON receipt. Wanted still checks current private bytes and saved
scope before owner-specific source reopening. A matching missing observation
adds bounded scan correlation to the reopening event, not authority to retry a
provider or change consent. Correlation requires the currently reconciling scan
run and acquisition, so a direct rebuild or replaced acquisition cannot borrow
an old scan's identity. Restored media is checked normally despite old
negative evidence. Existing single-source/legacy receipts remain unchanged.

Maintenance arriving during capture or publication uses the existing pause path.
Migration replay retains existing revision identities and observations. Adding
the volatile UUID default/generated path can rewrite the ledger during startup;
this is a synchronous schema change, not an online zero-lock migration.
Observed path membership uses a set rather than a receipt-by-file nested scan.
Root lookup handles Windows drive-qualified and process-drive-rooted spellings,
then checks host containment. SQL case folding is only a candidate superset.

## Alternatives and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Delete historical receipts after an empty walk | Small change | Loses evidence; stale walks can erase new deliveries | Reject |
| Trust size/mtime or scan tombstones as availability | Lower hash work | Cannot establish byte identity or current delivery authority | Reject |
| Revision-bound negative observation with late absence checks | Preserves history, transaction ownership and fresh deliveries | Extra capture/checks; filesystem and SQL still not atomic | Implement |
| Positive availability cache | Could reduce hashing | Needs ordered apply/organize/scan invalidation and byte witness ownership | Defer pending hash-cost evidence |

Stack: current scan acquisition → private pre-walk receipt capture → complete
walk → current revision/root/absence checks → atomic catalogue/negative/event
publication → current-byte Wanted/source reconciliation. Reuse ESM service/store
boundaries and existing workers. No new command system or rendered UI change.

## Limits and proof

First scope is the existing private two-owner delivery receipts, one disc-one file
per owner. Unsupported or unbound history cannot grant an observation. No lookup
time or whole-platform speedup is claimed. A negative observation describes the
publication check; SQL cannot fence unrelated external filesystem writes. Current
byte verification remains necessary. Aliased/out-of-scope receipt paths remain
conservative. Snapshot capabilities stay private and are not serialized.

Prove actual capture before walk, fresh missing-file publication and owner-specific
reopening, restored-file/new-revision/new-candidate refusal, changed private roots,
late lease/cancellation, required-event rollback, replacement/deletion FK cleanup,
snapshot bootstrap and bounded event output. Use actual workers/filesystem and
PostgreSQL, preserve failed candidates, then freeze source for fast and affected
serial checks. Main only; no release or PR merge.
