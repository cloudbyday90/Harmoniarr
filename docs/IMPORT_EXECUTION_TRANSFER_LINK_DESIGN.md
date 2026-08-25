# Import Execution Transfer Link Design

Status: Implemented
Date: 2026-08-25

## Purpose

Harmoniarr records the exact slskd transfer identifiers accepted for a selected
Import Review candidate. Until now, Downloader rebuilt the association by
expanding `planning_snapshot.execution.enqueuedTransfers` JSON every time it
read the live queue. That projection was a useful first step, but it is not a
durable relationship with database-enforced referential integrity.

This change makes the provider-confirmed transfer-to-candidate relationship a
first-class, additive database record. The relationship is created only after
slskd confirms a transfer identity, including when a prior interrupted handoff
is safely recovered by exact provider matching. It does not retry an ambiguous
provider request and it does not guess from filenames.

The related Wanted release remains derived through the existing durable path:

`provider transfer → execution item → import candidate → discovery lastSearchId → wanted release`

That is intentional. One shared discovery request can serve more than one
wanted release; placing one `wanted_release_id` directly on a provider transfer
would incorrectly discard that relationship.

## Research Basis

- PostgreSQL foreign keys preserve referential integrity, while unique
  constraints identify a fact that must not be duplicated. The link table uses
  both rather than trusting JSON or a client-provided association. [PostgreSQL:
  Foreign Keys](https://www.postgresql.org/docs/current/tutorial-fk.html)
  and [Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- PostgreSQL transactions make a completed database change visible atomically.
  The provider call remains outside the database transaction; therefore the
  worker writes a link only after provider confirmation and makes repeated
  confirmed observations idempotent. [PostgreSQL:
  Transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html)
- OWASP recommends server-side authorization, least privilege, deny-by-default
  access control, and tests for authorization rules. No browser supplied value
  can create or choose a link; the existing admin Downloader boundary remains
  the sole reader of the diagnostics. [OWASP Authorization Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- Future transfer-progress messages must communicate non-disruptively to
  assistive technology rather than moving focus during a queue refresh. This
  design adds no new UI message, but reserves that requirement for the next
  Music Queue presentation slice. [WCAG 2.2](https://www.w3.org/TR/wcag/)
  and [Understanding Status
  Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)

## Options Considered

| Option | Benefits | Costs / risk |
| --- | --- | --- |
| Keep deriving the link from execution JSON | No migration or write path | Read-time JSON expansion is not a constrained relationship and can become expensive or ambiguous as history grows. |
| Store an unconstrained transfer-to-candidate record | Simple lookup | A row could point to an unrelated run item or candidate; duplicates and conflicts are not safely detectable. |
| Store a provider-confirmed link with a composite foreign key and conflict verification | Durable, indexed, idempotent, and prevents cross-run/candidate corruption | Adds a small additive migration and one worker dependency. |
| Put one wanted-release ID directly on each transfer | Direct display lookup | Incorrect for shared discovery requests and couples provider data to a changing desired-state projection. |

## Final Recommendation Stack

1. Add `import_execution_transfer_links`, keyed by the provider, source user,
   and provider transfer identifier.
2. Use a composite foreign key to bind every link to the exact execution item,
   operation run, and import candidate that produced it.
3. Write links only after the provider returns an accepted transfer or the
   recovery service proves the existing transfer matches the prior request.
4. Make repeated confirmed observations idempotent. If a supposedly identical
   provider identity belongs to another execution item or candidate, fail the
   run instead of overwriting or guessing.
5. Have Downloader read this link table rather than execution-snapshot JSON.
   Keep the existing small, admin-only linkage response contract.
6. In a later Music Queue UI slice, expose a concise status such as
   “Downloading” with a separate, explicit action only when one is available;
   announce refresh changes with an appropriate status-message pattern without
   taking keyboard focus.

## Data Model and Lifecycle

`import_execution_transfer_links` stores only:

- Harmoniarr UUIDs for the operation run, execution item, and import candidate;
- provider name (`slskd`), source username, and provider transfer identifier;
- the time Harmoniarr made the confirmed association.

It deliberately excludes filenames, filesystem paths, raw provider payloads,
API keys, request headers, and user-supplied release IDs.

The execution worker has two eligible write points:

1. immediately after `enqueueDownloads()` returns its accepted transfers;
2. after `findMatchingTransfers()` proves a previously interrupted request was
   accepted.

The durable handoff checkpoint still occurs before the external provider call.
If recording a confirmed link fails, the run remains recoverable: the next
attempt rechecks slskd rather than sending the download request again.

## Security and Accessibility Boundaries

- This is server-only workflow evidence; no route accepts transfer-link input.
- Database constraints establish the exact run/item/candidate relationship.
- Conflict checks refuse a link that already belongs elsewhere.
- Parameterized queries are used for all runtime values.
- Downloader remains an existing admin-only diagnostic surface; no broad
  release or peer details are exposed.
- There is no dynamic UI addition in this slice, so no new live-region or focus
  behavior. The future UI must follow WCAG status-message guidance.

## Validation Plan

- Unit-test normalized confirmed transfer insertion, duplicate retry
  idempotency, and conflicting ownership rejection.
- Unit-test both normal enqueue and recovered-handoff worker paths.
- Unit-test Downloader reads the new table and no longer expands execution
  snapshot transfer JSON.
- Check migration naming, schema snapshot, ESM consistency, focused tests, full
  repository validation, and the existing open-PR applicability before commit.
