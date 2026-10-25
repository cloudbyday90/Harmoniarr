# Backup journal failure outcome

October 25, 2026. Implements the [producer follow-up](STRUCTURED_FILESYSTEM_FAILURE_OUTCOME.md).
See separate [design/tradeoffs](BACKUP_JOURNAL_FAILURE_DESIGN.md),
[official research](BACKUP_JOURNAL_FAILURE_RESEARCH.md) and
[no-cache Docker outcome](LOCAL_DOCKER_BACKUP_JOURNAL_FAILURE_OUTCOME.md).

## Delivered behavior

Journal publication/deletion/recovery now use a narrow ESM failure policy.
Recognized native codes reuse the finite filesystem catalog with fixed operation
labels; unknown/database failures receive a fixed journal fallback. Raw messages,
arbitrary codes, stacks and causes are excluded from newly written error fields.
Existing operation type, phase, IDs, snapshot and path columns remain the context.
Shared key-based redaction now masks `temporaryPath` as well as `storagePath`,
including after configured roots change.

The new error-only store method changes error fields and `updated_at` without
regressing persisted phase, linkage or completion time. Production composition
supplies it explicitly. Publication now awaits promotion/catalog work inside its
catch boundary so late rejections are recorded. Ordinary phase transitions and
confirmation/deferred recovery remain distinct. Original errors still propagate
to callers; journal-write failures retain their existing propagation behavior.

Native qualification exposed an existing delete-completion defect: after the
actual file and catalog row were deleted, completion attempted to restore the
deleted foreign key. Captured PostgreSQL code `23503`, finalized phase and zero
inventory rows established the failure. Completion now preserves `ON DELETE SET
NULL`, so one recovery attempt completes. Confirmation text also requests file
inspection instead of claiming no mutation happened; a post-promotion mismatch
can occur after the file moved.

No schema, dependency, branch or release is added. Old raw journal rows and
outward caller errors are outside this minimization increment. No rollback or
concurrent-owner safety guarantee follows from safe error text.

## Validation

- 33 focused checks pass, including policy injection resistance, temporary-path
  masking, async promotion rejection, delete failure and deferred recovery.
- Repository checks and lint passed in the default fast invocation. Its 6,023
  server cases had one existing controlled MusicBrainz HTTPS timeout (three-second
  request bound). All three HTTPS cases passed in isolation. The full server set
  was rerun with eight workers, followed by client/script tests and the production
  build: 11,208 passing tests (6,023 server, 4,485 client, 700 scripts). Bounds and
  assertions were not relaxed. The failed invocation remains evidence; isolated
  and bounded passes do not establish the timeout's cause or a general speedup.
- Frozen source: 3,527 files,
  `498c423ed5d12ae82a4ecabbd94b6b41f8f1b90b710819ab3d71931df068b625`.
- Before commit, a trailing blank line was removed from the shared test fixture.
  All other frozen code bytes and all runtime bytes are unchanged; seven fixture
  lifecycle checks pass after cleanup. Final source hash:
  `f32868574ea65e802117bd6d93acae541862065ab43b1f5e16363c5b4b5ec015`.
- Final packaged journal and earlier producer regressions pass. The journal proof
  uses actual permission-denied rename/unlink, catalog faults injected after real
  mutation, real PostgreSQL records and a separate composed recovery service.
  It verifies bytes/inventory, phase and completed metadata preservation, both
  held mismatch stages, deletion refusal before intent on a mismatched artifact,
  cleared deleted linkage, and truthful post-promotion messaging. This is
  restart-style fresh-record recovery, not a power-loss or concurrent-owner test.
- The initial native failure and the diagnostic foreign-key reproduction were
  retained with verified cleanup. Corrected/final cases pass. Unrelated native,
  SQL, browser and provider evidence is retained only after source/runtime review;
  it is not counted as new executions. The shared fixture was extracted rather
  than duplicated, and native work remains opt-in.

GitHub MCP found no open PRs on both checks for `cloudbyday90/Harmoniarr`.
There was no PR to apply, merge, rebase or close. Work remains on `main`.

## Next recommended item

Qualify exclusive backup promotion and concurrent recovery ownership. The file
service currently verifies destination state before a separate rename, whose
documented behavior can replace an existing target. Those calls alone do not
prove atomic no-overwrite behavior. Start with a held race fixture and choose a
protocol that preserves unrelated bytes and supports interrupted recovery; do not
infer an observed overwrite incident from this source-level boundary.

Separately, profile the slow unit fixtures and test-runner concurrency before
changing the default fast gate. This session's eight-worker invocation is local
validation evidence, not a repository-wide performance policy.
