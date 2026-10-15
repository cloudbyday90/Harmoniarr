# PostgreSQL runtime cleanup design

Date: 2026-10-15. Scope: the shared ESM fixture runtime and its consumers.

## Problem and decision

`createDatabaseRuntime().cleanup()` attempted template cleanup, then server stop.
Its catch recorded a stop rejection only when a template existed. Empty-schema
fixtures therefore reported successful cleanup after an owned server stop failed.
The wrapper could return a successful scenario result despite that failure.

Remove that template-dependent condition. Keep this correction in the existing
small lifecycle owner; a new service or generic cleanup framework would add no
responsibility boundary. Production services, database schema, fixture admission,
pool settings and container stop deadlines remain outside this change.

## Failure and completion contract

| Boundary | Required behavior |
| --- | --- |
| Runtime cleanup | Return the same cached promise on every call, including after rejection; attempt server stop once |
| Template release | Await completion before attempting server stop; still attempt stop after release fails |
| Failure precedence | Preserve the first template failure, otherwise the stop failure; arbitrary thrown values include null |
| Functional wrapper | Await cleanup after the scenario; preserve an earlier scenario failure, otherwise reject failed cleanup |
| Startup preparation failure | Await the owned stop attempt and retain the preparation failure |
| External PostgreSQL | Release only fixture-owned database/template resources; never acquire server-stop authority |

No retry or automatic success conversion is introduced. A rejected stop leaves
the actual server state uncertain. The native tests deliberately reject before
stopping, prove continued queries, then separately reap only their captured owner.
That test recovery does not change the runtime's cached failed result.

## Workspace ownership

The app runtime seals and drains admitted scenario/database work before releasing
PostgreSQL. Its workspace owner independently checks child and parent identity
and strict quiescence predicates. A refused child remains sticky and preserves
its original Error/null through a later PostgreSQL failure. A safely drained app
workspace can still be removed after a PostgreSQL stop failure: that server owns
separate container storage. A stop rejection alone grants neither database
shutdown proof nor permission to remove any uncertain media/workspace owner.

Keep these existing contracts; changing the unrelated workspace guard to retain
everything on any database error would conflate independent ownership boundaries.

## Efficient validation

Use a dedicated container-free contract file for schema modes, held completion,
Error/null precedence, wrapper behavior and borrowed authority. Reuse existing
app/workspace tests for retention. Add just two native cases, one per schema
mode, with real scenario queries/drop, held pre-stop rejection, continued queries
and exact-owner retirement. Register actual operations and drain them in an
afterEach hook rather than trusting test-runner timeout as cancellation.

The complete fast gate supplies lint, static checks, server/client/script tests
and builds once final JavaScript is frozen. Large media/scaling matrices provide
no additional evidence for this condition and are not repeated.

See [official research and options](POSTGRES_RUNTIME_CLEANUP_RESEARCH_2026_10.md)
and [executed outcome](POSTGRES_RUNTIME_CLEANUP_OUTCOME.md).
