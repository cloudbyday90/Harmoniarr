# Control-Plane Idempotency Reservations Outcome

## Delivered

On 2026-08-24, Harmoniarr's shared control-plane idempotency layer gained a
durable in-progress reservation. It now prevents concurrent same-key requests
from executing the protected mutation twice.

- `control-plane-idempotency-service.js` remains a small ESM factory and now
  owns the reservation, completed-result replay, bounded recovery, and clear
  `409 idempotency_key_in_progress` contract.
- `control-plane-idempotency-store.js` provides modular persistence operations
  to create a reservation, complete it, conditionally remove a stale record,
  and remove a failed in-progress record. It contains no route policy.
- A forward-only migration adds `in_progress` and `completed` states and makes
  the scope/actor/key unique even when the actor is `NULL`.
- Existing records are safe by default: they are marked `completed`, and any
  old duplicate null-actor cache records are reduced to their newest entry
  before the stronger constraint is added.
- No external cache, lock broker, CommonJS module, broad singleton, or change
  to the self-hosted Compose topology was introduced.

## Validation

The following checks passed on 2026-08-24:

| Check | Evidence |
| --- | --- |
| Focused idempotency service and store tests | 17 passing tests, including the simultaneous same-key request that must receive `409` without a second mutation. |
| Focused ESLint | Passed with zero warnings for the changed service, store, and tests. |
| `npm run migration:check` | Passed; the generated migration has a valid forward-only identifier and surrogate-key policy. |
| `npm run check:schema-snapshot` | Passed after generating the snapshot from all 90 migrations. |
| `npm run validate:schema-bootstrap` | Passed; a new database applied all 90 migrations and matched the schema snapshot. |
| `npm run validate` | Passed; copyright, migration/schema, ESM, image/topology, lint, server/client/script/integration tests, and production build all completed. |
| Local walkthrough Compose rebuild | Passed using `LOCAL_DOCKER_WALKTHROUGH.md`; the rebuilt container is healthy on `127.0.0.1:47956`, reports zero pending migrations, and its PostgreSQL catalog confirms `NULLS NOT DISTINCT` for the new unique constraint. |

## Open PR assessment

The available local copy of open Dependabot PR #40
(`codex/pr-40-local`, `649659f`) was inspected without merging it. It changes
only the controlled-provider test fixture from `node:24.19.0-alpine` to
`node:26.7.0-alpine`.

No part of that PR was applied locally. As of 2026-08-24, Node.js identifies
24.19.0 as the latest LTS and 26.7.0 as the Current release, and recommends
production applications use Active or Maintenance LTS releases. Keeping the
fixture on the same supported 24.x LTS line as Harmoniarr's runtime is the
secure, stable self-hosted choice.
[Node.js releases](https://nodejs.org/en/about/previous-releases)

Live GitHub PR status could not be refreshed because the local GitHub CLI
credential is unauthorized; this is an assessment of the locally available PR
branch only.

## Next recommended work

Audit the shared control-plane mutations for external side effects that occur
outside the local PostgreSQL transaction, beginning with provider-facing
actions. Where a crash after the side effect but before idempotency completion
could safely be duplicated, add a narrow operation-specific outbox or reuse a
provider-supported idempotency key. Do not broaden the shared reservation into
a distributed-lock platform for the normal self-hosted deployment.
