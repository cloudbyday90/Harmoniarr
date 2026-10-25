# Backup journal failure design

October 25, 2026. Extends the [producer policy](STRUCTURED_FILESYSTEM_FAILURE_OUTCOME.md)
to backup artifact publication, deletion and restart-style recovery.

## Decision

Use a small journal-specific ESM policy. Recognized filesystem codes use the
shared finite catalog and fixed publish/delete labels. Unknown failures (including
catalog/database failures) use a fixed journal message/code rather than claiming
a particular filesystem cause. Do not copy raw messages, codes, stacks or causes.

Reuse existing journal context: operation type, phase, storage/temporary paths,
artifact snapshot and identifiers. Do not duplicate paths into a new JSON field or
change the schema. Add `temporaryPath` to shared key-based redaction so both paths
are masked independently of current root settings.

Persist failures through a dedicated store operation that updates only error
columns and `updated_at`. It must preserve persisted phase, artifact linkage and
completion time even when the caller holds a stale pre-mutation snapshot. Keep
the existing phase-changing update contract separate. Supply the new store method
through production system-module composition and injectable service dependencies.

Await publication inside its try/catch so rejected promotion/catalog promises are
actually recorded. Keep verification/confirmation outcomes distinct from ordinary
failure, and leave the original thrown error identity and current failure-recording
error propagation intact. Recovery still returns deferred/held/completed/abandoned
according to existing verification and filesystem/catalog state. Safe text is not
proof that a mutation was undone or that another mutation is authorized.

Delete completion preserves the foreign key's automatic null after inventory
deletion instead of writing the deleted ID back. Confirmation messages request
inspection without claiming no mutation occurred; verification can fail after
promotion has already moved a file.

## Alternatives and final recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Redact raw strings only at read time | Minimal producer work | Retired roots and native wording remain ambiguous | Keep as defense, insufficient alone |
| New journal metadata/schema | Flexible structured payload | Duplicates existing paths/context and adds migration work | Defer |
| Reuse phase-changing update for failures | Fewer store methods | Can regress phase from a stale object and clear completion data | Reject |
| Fixed producer policy plus error-only SQL update | Safe durable text, bounded code set, preserves current state | Adds one narrow policy/store method; loses raw vendor prose | Adopt |

Final stack: owned journal context + shared finite filesystem code policy → fixed
journal error presentation → error-only store update → existing verified recovery
state machine → shared path-key redaction where records are projected. No new
process, singleton, dependency, schema, branch or release.

## Validation and limits

Test hostile messages/codes, native and unknown errors, async publication rejection,
delete failure and deferred recovery, plus current confirmation handling. Use
disposable packaged PostgreSQL and real files for promotion/unlink failures,
failures after file mutation, fresh composed recovery, inventory/byte parity and
held mismatches. Verify error-only updates preserve phase/link/completion state.
Native work remains opt-in; use one final stable fast gate and exact source/runtime
comparison to retain unrelated browser/media/provider evidence.

This minimizes newly written journal error fields. It does not rewrite old rows,
sanitize the original thrown exception or establish concurrency control between
independent recovery owners. Current journal data already contains explicit paths;
authorized repair context and read-time minimization remain separate concerns.
