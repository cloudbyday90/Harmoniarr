# Import Apply Filesystem Confirmation Design

Status: **Implemented.**

## Decision

Import Apply treats a process interruption between a filesystem mutation and its
database record as an indeterminate state. It records the exact intended file
mutation in the existing per-run item immediately before the mutation, then
confirms source and destination state on a resumed run before taking another
filesystem action.

This is deliberately a local, self-hosted design. It adds no external queue,
distributed transaction coordinator, cloud dependency, or background service.

## Problem

The old flow wrote the successful `import_operations` record only after a
stage or final library mutation completed. A crash in that interval could leave
the file changed while the run still appeared unfinished. Re-running the plan
could then encounter a collision or, worse, make an unjustified assumption
about an incomplete copy-and-remove operation.

PostgreSQL transactions are all-or-nothing only for database work; they do not
include filesystem changes. Node also documents that `copyFile` is not atomic
and may leave a destination after an error. A database record after the file
operation alone therefore cannot make the pair transactional.

## Research inputs

| Official source | Applied finding |
| --- | --- |
| [Node.js filesystem API](https://nodejs.org/api/fs.html) | `copyFile` has no atomicity guarantee, may leave a destination after failure, and concurrent filesystem changes can corrupt state. The recovery code must observe the result rather than retry blindly. |
| [POSIX `rename`](https://pubs.opengroup.org/onlinepubs/9799919799/functions/rename.html) | POSIX defines `rename` as atomic, but this product's cross-volume copy/hardlink fallbacks are not covered by that single-operation guarantee. |
| [PostgreSQL transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html) | A transaction provides all-or-nothing database changes; it is not a transaction spanning the local filesystem. |

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Blindly replay an interrupted mutation | Smallest code change | Can duplicate work or make an unsafe inference from partial filesystem state | Rejected |
| Hold every interruption for manual repair | Safest possible default | Leaves recoverable work unnecessarily stalled | Rejected |
| Add a distributed transaction or external workflow broker | Can coordinate more systems | Inappropriate complexity and operational burden for a home-hosted application; filesystem still has no universal two-phase transaction | Rejected |
| Persist a local intent and prove the postcondition | Uses existing run-item storage, is audit-friendly, and permits safe recovery when the state is provable | Requires careful pre-mutation persistence and conservative ambiguity handling | Chosen |

## Implemented flow

1. The Apply worker persists each candidate as an existing run item.
2. Immediately before `stage` or `finalize` changes a file, the operation
   service sends a mutation intent to the worker. The intent includes source,
   destination, expected byte size, requested transfer mode, source-removal
   behavior, step, and operation position.
3. The worker writes that intent and the immutable full preview to the run
   item before the filesystem service is called. A checkpoint write failure
   prevents the mutation from starting.
4. After a restart, the worker checks both paths against the intent:

   | Observation | Result |
   | --- | --- |
   | Expected destination and expected source state | Confirmed; resume from the next step or record the final step without re-running it |
   | No destination and intact expected source | Safe to retry |
   | Any other state, missing expected size, wrong size, or partial state | `awaiting_confirmation`; do not mutate automatically |

5. Confirmed operations reuse their original operation position. The operation
   ledger upserts by run, file, and step so a crash after a successful ledger
   write remains idempotent.

## Security and safety constraints

- The existing media filesystem service still enforces configured source and
  destination root boundaries and exclusive destination creation.
- Recovery uses `stat` only. It does not unlink, overwrite, or move a file
  while the state is ambiguous.
- Byte-size equality is required before a completed mutation is accepted.
- Paths and plan data remain in the authenticated local run detail; no data is
  sent to a third-party service.
- The user-facing state is concrete: **Confirm filesystem change**, with the
  source, staging, and library paths already present in the run item.

## Recommendation stack

1. Keep the durable run-item checkpoint as the recovery boundary.
2. Keep postcondition-based confirmation conservative; treat uncertainty as a
   stop condition, never as permission to retry.
3. Preserve the existing scoped filesystem service for all mutation and root
   checks.
4. Keep user messaging action-oriented: inspect the paths, correct the local
   filesystem if needed, then start a fresh Add downloads run.
5. Apply the same publication pattern next to backup-export package creation
   and rename/move finalization.
