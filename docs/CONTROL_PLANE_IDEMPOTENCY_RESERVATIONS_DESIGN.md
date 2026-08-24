# Control-Plane Idempotency Reservations Design

## Status

Implemented 2026-08-24.

## Problem

Harmoniarr already retained a completed response for an `Idempotency-Key`, but
only wrote that record after a mutation finished. Two identical requests that
arrived before that write could both run the mutation. This affected all users
of the shared control-plane service, including authenticated recovery and
Music Queue mutations and unauthenticated-actor provider webhooks.

The old composite database constraint had a second gap: PostgreSQL normally
treats `NULL` values as distinct. Webhook records use a `NULL` actor, so the
old key could not enforce uniqueness for that caller class.

## Research

Research was reviewed on 2026-08-24 using official primary sources.

- The latest IETF `Idempotency-Key` Internet-Draft calls for a client-generated
  unique key, payload fingerprinting, a published expiry policy, replay of a
  completed result, and a `409 Conflict` while the original request remains
  outstanding. It is an **expired Internet-Draft**, not an RFC, so it guides
  the implementation rather than imposing a protocol requirement.
  [IETF document status](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/)
  and [draft 07](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header-07)
- PostgreSQL documents that `UNIQUE` normally considers null values distinct;
  `NULLS NOT DISTINCT` makes a missing actor part of the enforced composite
  key. [PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- PostgreSQL documents `INSERT ... ON CONFLICT DO NOTHING` as the appropriate
  conflict action for a unique-index-backed claim without overwriting the
  existing row. [PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html)
- PostgreSQL cautions that normal index builds block writers and concurrent
  builds cannot run inside a transaction. This small embedded/self-hosted
  table uses a migration transaction and a constraint replacement rather than
  adding external coordination or a second service. [PostgreSQL CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html)

## Options

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Keep completed-result storage only | No schema change. | Same-key concurrent retries can run the mutation twice. | Reject. |
| In-memory single-flight map | Small implementation. | Loses protection on restart and cannot coordinate separate processes. | Reject. |
| Per-route reservation tables | Tailored policies. | Duplicates retention, hashing, recovery, tests, and migrations. | Reject. |
| Shared durable reservation | One ESM service and table boundary for all control-plane callers; clear concurrent result; no external dependency. | Requires a migration and an expiry/recovery policy. | **Adopt.** |
| Full transactional outbox for every mutation | Stronger delivery guarantees for external effects. | Larger platform-wide change; not needed to close this race. | Defer for external-side-effect workflows. |

## Contract

The durable lookup key is the operation scope, actor ID (including a missing
actor), and normalized idempotency key. A SHA-256 hash of the trusted request
payload prevents the same key from being reused for a different operation
input.

| Situation | Result |
| --- | --- |
| First matching request | Atomically inserts an `in_progress` reservation, then runs the mutation. |
| Same key and payload while reserved | `409 idempotency_key_in_progress`; no second mutation runs. |
| Same key with a different payload | Existing-compatible `409 idempotency_key_payload_mismatch`; the key cannot reveal or change another request. |
| Completed matching retry | Replays the original response body and status without invoking the mutation. |
| Mutation throws before completion | Deletes only its still-`in_progress` reservation, so a retry can start. |
| Abandoned reservation | Expires after 60 minutes. A later matching retry conditionally removes it and obtains a new reservation. The existing hourly cleanup also removes expired rows. |
| Completed response | Remains replayable for 48 hours, then expires. |

The service intentionally retains a reservation if the business mutation
succeeds but storing its completed result fails. Returning an error while
keeping the reservation is safer than silently permitting an immediate second
execution. The bounded expiry provides recovery for that exceptional state.

This is at-most-one execution for a live reservation, not a universal
exactly-once guarantee. A crash after an external side effect and before the
completion write can be retried after expiry. A mutation with external effects
must continue to use its own domain transaction, provider idempotency key, or
outbox design.

## Schema migration

`20260824_232158_control_plane_idempotency_in_progress_reservations.sql`:

1. Adds `state`, defaulting existing rows to `completed`.
2. Collapses historical duplicate records deterministically, retaining the
   newest short-lived cache entry. This only affects the idempotency replay
   cache, not releases, artists, downloads, or user accounts.
3. Replaces the original constraint with `UNIQUE NULLS NOT DISTINCT` over the
   scope, actor, and key.

This assumes Harmoniarr's embedded PostgreSQL 18 runtime, which supports
`NULLS NOT DISTINCT`. It deliberately does not add Redis, an external database,
or clustered lock management to the self-hosted deployment.

## Security

- Existing route authentication, fresh-session checks, CSRF validation,
  authorization, and business-state locks run before or within the normal
  mutation path; a key is not an authorization credential.
- Actor plus operation scope isolate one household user's replay record from
  another's and prevent cross-operation reuse.
- The record stores a payload hash, not the raw request input. Existing
  response storage is replayed only after the ordinary route security checks.
- Parameterized PostgreSQL queries and a 255-character key limit constrain
  database input and storage growth.
- The API uses the established `Idempotency-Key` field, and all changed server
  and test modules remain native ES modules.

## Verification

- Service tests cover completed replay, changed payload rejection, a true
  simultaneous request, failed-mutation cleanup, stale-reservation recovery,
  actor scope, expiry, and key validation.
- Store tests cover reservation creation, completion, null-actor conflict,
  conditional expiry deletion, and scheduled cleanup behavior.
- Schema-bootstrap validation applies all migrations, including the constraint
  replacement, from an empty database and verifies the generated snapshot.

## Recommendation stack

1. **Delivered:** use one durable `in_progress` reservation before every keyed
   control-plane mutation, then replay its completed result for 48 hours.
2. **Delivered:** enforce one key for a missing actor with PostgreSQL
   `NULLS NOT DISTINCT`, protecting webhook callers as well as authenticated
   users.
3. **Keep:** route-level authentication, CSRF, business-state transactions,
   and Music Queue's candidate-selection guard; idempotency complements rather
   than replaces them.
4. **Next:** audit control-plane mutations that can trigger an external side
   effect and introduce an operation-specific transactional-outbox or provider
   idempotency boundary where a crash-retry could duplicate that effect.
