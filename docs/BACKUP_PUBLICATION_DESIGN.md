# Exclusive backup publication and recovery ownership

October 25, 2026. Follows the [journal outcome](BACKUP_JOURNAL_FAILURE_OUTCOME.md).

## Decision and stack

Publish the already-written/synced private temporary file with an exclusive hard
link. Never fall back to rename or copy on unsupported filesystems. Destination
existence at the atomic link step means confirmation is required; preserve both
paths and publish no inventory row. Verify the final file, then unlink a temporary
name only when `lstat` proves both regular files share device/inode. Restart-style
recovery accepts an absent temporary name (including legacy rename records), but
holds a different temporary identity for inspection rather than deleting it.

Use one coarse PostgreSQL session advisory lock for all production backup file
operations. One checked-out client owns the lock and all journal/catalog queries.
SQL remains autocommit so intent and intermediate phases are durable before the
next filesystem step. Fresh recovery lists records only after ownership is held.
The public production facade constructs a scoped core service per ownership run;
no global mutable service or second process is added.

Check the pinned connection before each future metadata/file mutation admission.
Connection loss refuses later steps; already admitted I/O must still settle before
cleanup. Explicitly unlock before returning a healthy client; destroy lost or
uncertain clients. Preserve work Error/null over cleanup failures. Busy publish/
delete requests receive a fixed conflict; busy recovery returns explicit ownership
busy without pretending a known number of operations were recovered or deferred.

Final stack: existing durable intent → shared session ownership/pinned client →
exclusive hard-link publication → byte/manifest verification → inode-owned cleanup
→ existing catalog/phase updates and journal failure policy. No schema/dependency
change, branch or release.

## Alternatives and tradeoffs

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Check then rename | Simple and familiar | Existing target can be replaced in the check/mutation gap | Reject |
| Exclusive copy | Refuses a preexisting target | Partial final visibility; Node does not promise copy atomicity | Reject |
| Hard link then verified unlink | Complete-file visibility; exclusive destination; recoverable dual names | Requires hard-link support; cleanup is a separate step | Adopt |
| Long SQL transaction across file work | Transaction ownership | Filesystem cannot roll back; phases may remain uncommitted | Reject for this protocol |
| Per-operation or per-path locks | More parallelism | Aliases and multiple records complicate ownership | Defer |
| Coarse session lock with autocommit | Simple cross-process cooperation; durable phases; bounded one lock | Serializes unrelated backup work and pins one connection | Adopt first |

## Evidence and limits

The before-change fixture observed replacement of unrelated destination bytes.
Qualify a held destination race, a lost cleanup step, dual-name recovery, unrelated
temporary preservation, concurrent owners and a one-client pool using actual
PostgreSQL/files. Add admission/error cleanup tests at the narrow owner boundary.
Keep native work opt-in, use bounded full validation and rebuild Docker without
cache, preserving existing administrator/data/mounts.

The atomic claim applies to destination creation on supported filesystems, not the
entire file/database workflow or power-loss durability. Directories are trusted
application storage; arbitrary same-UID path replacement is not fully fenced by
Node pathname APIs. Session loss can release the server lock while earlier native
I/O is settling; no general distributed fencing claim follows. Unsupported links,
unverified bytes and ambiguous cleanup fail closed. Concurrent ownership covers
cooperating production entry points, not arbitrary direct store/filesystem calls.
