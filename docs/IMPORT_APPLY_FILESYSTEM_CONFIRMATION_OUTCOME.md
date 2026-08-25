# Import Apply Filesystem Confirmation Outcome

Status: **Implemented and validated.**

## Delivered changes

- Added `media-file-mutation-confirmation-service.js`, a focused ESM service
  that classifies an interrupted mutation as `confirmed`, `safe_to_retry`, or
  `ambiguous` from local source/destination state and expected size.
- Extended the Import Apply preview with source file byte size so recovery has
  a durable comparison value.
- Added a per-mutation checkpoint callback to the modular Apply operation
  service. It runs before every mutating stage/finalize call.
- Preserved existing Apply run items during recovery instead of replacing their
  snapshots, then continued only the candidates that belonged to that run.
- Recorded confirmed stage operations and finalized confirmed library changes
  without repeating their filesystem operation.
- Upserted the operation ledger by run/file/step, making the post-mutation
  record idempotent after an interruption.
- Added the `Confirm filesystem change` status and count to the Add downloads
  panel. Ambiguous results show the existing source, staging, and library path
  cards plus a message explaining that Harmoniarr stopped automatically.

## Validation evidence

- Focused Node tests cover completed moves, safe retries, ambiguous state,
  hardlink-style source preservation, pre-mutation checkpoint ordering,
  confirmed-final recovery without mutation, and a worker that holds ambiguous
  state without invoking the mutator.
- Server, client, and test lint checks pass with zero warnings.
- `npm run validate` passed: copyright, migration and schema checks, ESM,
  lint, all server/client/script tests, 35 integration tests, and production
  client/server builds.

## Operational result

An interrupted Add downloads run now has three explicit outcomes:

| State | Harmoniarr behavior |
| --- | --- |
| Proved complete | Records the operation and continues from the correct next step. |
| Proved untouched | Rebuilds the preview and retries through the normal guarded filesystem service. |
| Not proved | Stops at **Confirm filesystem change** and makes no additional file change. |

This is a recovery improvement only; it does not alter the configured source,
staging, library-root, collision, or quality policies.

## Next recommended item

Audit backup-export publication and retention cleanup with the same pattern:
write a durable package intent, publish through a temporary artifact and
atomic local rename where available, verify the manifest, and only then prune
the prior backup. This is the next high-value crash window because backup
creation and cleanup also cross filesystem and database/audit boundaries.
