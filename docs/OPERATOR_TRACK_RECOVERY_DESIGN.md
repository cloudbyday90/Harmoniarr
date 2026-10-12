# Two-owner delivery recovery and source lifecycle

October 12, 2026. Main baseline `6d40849`. Separate research/outcome documents
record official sources and executed evidence. This extends the bounded
[two-owner union](OPERATOR_TRACK_UNION_DESIGN.md), preserving its two distinct
disc-one tracks, private roots and exact shared manifest.

## Selected boundaries

Reuse the existing apply worker, durable operation runs and candidate JSON store.
After each verified private delivery, commit a bounded server-owned delivery
checkpoint and required candidate event in one transaction. Bind it to the full
accepted participant set, recipient/request/file/track, current root and actual
file hash. Capture both delivery plans, including the unresolved recipient's
root/target, so retry cannot silently accept a changed peer plan. Capture/recheck
the apply acquisition and current consent/catalog;
canonical save scopes, projection, source rows and candidate writes use existing
lock boundaries and one transaction client. A partial checkpoint is recovery
evidence, not request fulfillment or an applied candidate.

Preview may mark an existing delivery ready only after reading the durable
checkpoint and rechecking current bytes, media identity, exact target/root and
the complete participant set. Operation execution independently repeats that
check; a preview flag or size-only filesystem confirmation is not authority.
Resolve the current private root and reject a redirected owner directory. Recheck
the run/acquisition before filesystem mutation, after checkpoint events and after
the required final candidate event. Expiry at these gates refuses publication.
Retain a verified delivery without copying/overwriting it, then apply only the
unresolved recipient. Keep shared downloaded input and existing quality,
safe-auto, maintenance, cancellation and exclusive mutation rules.

Publish both owner receipts, candidate applied state and required event through
the existing final transaction. Recheck actual destination bytes before claiming
fulfillment. Unrecorded crash copies, changed/malformed checkpoints, stale roots,
changed consent/catalog, arbitrary unions and uncertain old mutation intents
remain conservative. Filesystem mutation and SQL are not one atomic resource:
a copy without a committed checkpoint requires review rather than silent adoption.

Retire only the two exactly owned typed source requests by moving them to the
existing already-exists state after verified fulfillment. Bind a server marker
to the candidate/scope; required source events commit with the change. Wanted
reconciliation rechecks current private-root bytes and active matching saved
scope, retires available owned sources and reopens only a previously retired
matching source whose delivery is no longer available. Reads remain side-effect
free. Reopening uses the ordinary existing request/discovery flow; it does not
grant replay of an obsolete shared candidate or another provider POST after a
partial private copy failure.
An exact reopened marker also prevents that request's old applied receipt from
suppressing ordinary reacquisition. A newer verified receipt can retire it again;
an older missing receipt cannot override newer available evidence.

## Alternatives and recommendation stack

| Option | Benefit | Cost or limit | Decision |
| --- | --- | --- | --- |
| Repeat the complete shared import/download | Small implementation | Collisions, duplicate work and unsafe provider replay | Reject |
| Adopt any matching filename/size | Easy recovery | No provenance, owner or byte authority | Reject |
| Durable bounded candidate checkpoints and existing request states | Reuses command/store/event owners; no second job system | JSON reads and filesystem verification; unrecorded crash copies remain review | Implement |
| Indexed receipt ledger with scan invalidation | Better large-library lookup and retained lifecycle indexing | New schema/backfill/scan ownership contracts | Separate measured follow-up |

Stack: accepted two-owner scope → lease/current-source admission → verified
private delivery → atomic bounded checkpoint/event → independent revalidation
on resume → remaining delivery only → final receipts/event → source retirement
and owner-specific reopening. No pool/deadline increase or blanket security/WCAG
certification is implied.

## Proof

Reproduce partial private delivery refusal and stale fulfilled sources first.
Prove one failed recipient, durable first checkpoint, real process/run retry with
unchanged first bytes and only one remaining file mutation, no provider dispatch,
current consent/root/catalog refusal, altered bytes/malformed checkpoint refusal,
lease expiry/replacement/cancellation, required-event rollback and replay.
Use real PostgreSQL, actual media and filesystem containment. Retire two source
requests, remove fulfilled Wanted/discovery work, then change one delivery and
reconcile: only that owner's existing source/Wanted returns. Preserve unrelated
owners and legacy single/full-release behavior. Finish focused review before a
frozen fast gate and affected serial native checks. Main only; no release/merge.
