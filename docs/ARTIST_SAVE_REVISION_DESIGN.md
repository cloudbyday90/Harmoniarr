# Required artist-save revisions

Date: September 12, 2026. Baseline: `035548f`.

## Design

Artist policy, release selections, track overrides, snapshots, and reconciliation intent form one transactional save. Require `expectedSnapshotRevision` as a non-negative safe integer. Zero means no saved snapshot; an existing snapshot requires its exact revision. Reject absent, null, string, fractional, negative, and unsafe values with 400 before opening a transaction. Return the existing 409 conflict code for a stale revision without replacing any state.

Serialize saves with a transaction-scoped advisory lock keyed by operator and artist, acquired before monitoring or snapshot reads. Row locks alone cannot lock an absent first-save row. Keep the existing row locks and transaction boundary; a separate SQL store owns locking and revision reads, and a small shared revision policy validates both policy saves and manual edition saves. Advisory-key collisions can serialize unrelated saves but cannot mix their identities: queries retain exact operator and artist IDs.

Canonicalize UUIDs in PostgreSQL before hashing the lock key; equivalent uppercase or alternate UUID spellings must share the same lock. Normalize canonical bigint strings returned by the PostgreSQL driver only at the persistence boundary, rejecting malformed or unsafe values. The public API remains strict numeric JSON.

The lock/read protocol uses the platform's default PostgreSQL Read Committed isolation. Changing connection defaults to Repeatable Read or Serializable requires revisiting snapshot visibility and transaction retry behavior; those isolation modes are not introduced or validated by this change.

The client must send the revision from the loaded projection and retain drafts on conflict. Add artist uses explicit revision zero, so it cannot overwrite an existing saved policy. Do not automatically retry stale drafts with a refreshed revision. Preserve fresh-session, CSRF, ownership, maintenance, and reconciliation behavior.

## Alternatives and recommended stack

| Approach | Pros | Cons |
| --- | --- | --- |
| Required JSON revision and per-operator/artist transaction lock | Extends existing contract; protects initial and subsequent saves; no new infrastructure | Callers omitting revision must update; concurrent edits need deliberate review |
| HTTP ETag / If-Match | Standard HTTP conditional representation updates | Requires coordinated representation/validator design and client migration; larger scope |
| Serializable transactions with retries | General database anomaly protection | Broader retry/transaction changes; does not itself express the user's expected version |
| Automatic last-write-wins or revision refresh | Fewer visible conflicts | Can silently overwrite another editor's saved intent; rejected |

Recommend Node 24 native ESM, modular service/store factories, Vue composables, PostgreSQL transactions with the existing 400/409 JSON API, and explicit conflict feedback. Keep existing operation workers. No dependency, database schema, or HTTP precondition migration is needed.

## Official research

Discovered and read through research tools on September 12, 2026:

- [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html), sections 15.5.10 and 15.5.13: 409 covers version conflicts; 412 concerns failed request-header preconditions.
- [RFC 6585](https://datatracker.ietf.org/doc/html/rfc6585), section 3: 428 permits requiring conditional requests. It does not require replacing this application's established body revision contract.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html): row locks protect retrieved rows; transaction advisory locks release at transaction end. Consistent lock acquisition order matters.
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html): Read Committed obtains a fresh snapshot for each command, allowing the revision read after a lock wait to observe the preceding committed save.
- [W3C form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/): errors need clear text and recovery guidance. Preserve drafts and announce conflicts through the existing error presentation; do not silently reload or move focus unexpectedly.

These sources inform the design; focused browser verification does not establish full WCAG conformance.

## Bounded guarantee

The active policy-save paths converge on the canonical save service. Its required revisions protect those saves against one another. Existing administrative restore code can replace monitoring, selections, and overrides without advancing the reconciliation snapshot revision; this slice does not establish concurrency protection against restore operations. Aligning restore maintenance coordination and revision invalidation is a separate follow-up. Standalone snapshot-save methods currently have no production callers; future writers must join the same locking and revision protocol.

## Acceptance

Test validation before any connection, initial revision zero, sequential saves, simultaneous initial saves, stale concurrent updates, and complete rollback/no extra snapshots or jobs from rejected saves against real PostgreSQL. Verify all production callers send an explicit revision and retain operator draft intent on conflict. Record implementation, PR review, Docker results, and final validation in the separate outcome document.
