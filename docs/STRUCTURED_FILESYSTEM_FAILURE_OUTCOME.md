# Structured filesystem failure outcome

The journal follow-up is implemented in the separate
[backup journal failure outcome](BACKUP_JOURNAL_FAILURE_OUTCOME.md).

October 25, 2026. Completes the first producer step from
[configured-path redaction](CONFIGURED_PATH_REDACTION_OUTCOME.md). See separate
[design and tradeoffs](STRUCTURED_FILESYSTEM_FAILURE_DESIGN.md),
[official research](STRUCTURED_FILESYSTEM_FAILURE_RESEARCH.md) and
[no-cache Docker outcome](LOCAL_DOCKER_STRUCTURED_FILESYSTEM_FAILURE_OUTCOME.md).

## Delivered behavior

A small pure ESM policy maps 24 recognized native filesystem codes to fixed
explanations and correction guidance. It accepts fixed operation context and
explicit source/destination fields; native messages, causes, stacks, syscalls,
arbitrary properties and unrecognized code strings are not copied into descriptors.
Code is captured once before classification, avoiding changing-property reflection.

Restore payload reads now persist a safe message and descriptor in their run
summary and failure audit event, then throw a fresh safe error. Unknown read
failures use a fixed fallback. Restore lock release and non-read validation/scope
handling remain intact. Import file results recognize catalogued native codes,
write safe text to existing operation rows and include the descriptor in existing
`fileOperations` snapshots. Existing stop-after-failure and remaining-file behavior
is preserved. The shared policy masks path-owned descriptor fields after settings
change, independently of remembered root names.

This is incremental coverage for newly recorded selected failures. Old raw rows
are not rewritten. Non-filesystem import exceptions, other producer branches and
authorized file-repair detail fields retain their existing handling. No schema,
dependency, retry/mutation authority, release or branch change is involved.

## Validation

- 63 focused checks pass across the new policy, restore, import operation/worker,
  shared filesystem guards and redaction. Cases include all supported codes,
  hostile/unknown messages and codes, changing code properties, original-error
  preservation, owned paths and existing cancellation/policy/mutation behavior.
- One stable final fast gate passes 11,202 tests: 6,017 server, 4,485 client and
  700 scripts, plus lint, repository checks and the production build. Source:
  3,523 files, `6d07ece7e38eec502ef155fa161e778eb9e1da39862582f810e58ff5f7425a70`.
- The enhanced existing Recovery browser check passes, including escaped legacy
  content, distinct rows, refresh focus and structured explanation after a root
  change. The 390px screenshot was inspected; the fixed explanation and correction
  guidance fit without exposing the filename. Real screen-reader/device checks
  remain deferred as requested.
- Two final packaged-runtime tests pass: actual filesystem/SQL producer evidence
  and the existing composed configured-root HTTP regression. The new native proof
  uses a real missing-file read and a real invalid import destination parent. It
  verifies run/audit and import row/JSON snapshot persistence, lock release, source
  preservation, historical redaction, unauthorized refusal and no-store responses.
  Restore artifact lookup/preflight and import track selection are controlled
  fixture dependencies; this does not prove a successful restore or full worker run.
- Unrelated native/media, SQL, browser and provider/file-backed evidence is retained
  only after exact source/runtime review. It is not described as newly executed.

The first native attempt stopped at a fixture import-path mistake before exercising
production behavior. Its failure and verified container cleanup were retained;
the corrected and final invocations passed. Native work stays opt-in. The fast gate
adds five cheap tests and reuses the existing browser scenario; no concurrency or
coverage reduction is claimed as a speed improvement.

GitHub MCP returned zero open PRs on both checks for `cloudbyday90/Harmoniarr`.
There was no PR to apply locally, merge, rebase or close. Work remains on `main`.

## Next recommended item

Apply the same producer policy to the backup-artifact publish/delete journal.
`backup-artifact-file-operation-service.js` still copies raw `error.message` into
`lastErrorMessage` through `getErrorDetails`. Preserve its filesystem-confirmation
and restart/recovery state machine while replacing that free text with safe code,
operation context and owned paths. Qualify interrupted publish/delete and actual
recovery separately; do not infer successful rollback from a safe error message.

The independent test-efficiency investigation identified in the prior outcome
remains useful. Profile implicit I/O/timeouts in the slow unit fixtures before
changing concurrency, removing checks or adding more default native work.
