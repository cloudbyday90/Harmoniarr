# Structured filesystem failures

October 25, 2026. First producer increment after
[configured-path redaction](CONFIGURED_PATH_REDACTION_OUTCOME.md).

## Decision and scope

Use a small pure ESM failure policy with a finite native-code catalog, fixed
operation labels, fixed explanatory text and explicitly owned `sourcePath` and
`destinationPath` fields. Never parse or copy the native message, stack, cause,
syscall, arbitrary properties or unrecognized code into the descriptor.

Wrap failures specifically at the restore payload read. Persist its descriptor in
the existing run summary/audit details and throw a fresh safe error with the
normalized code. Unsupported read failures use a fixed fallback. Preserve lock
release and other restore validation/scope errors.

At the import file-result boundary, recognize only catalogued filesystem codes.
Persist safe text in the existing operation row and retain the descriptor in
`fileOperations` (already saved in the worker's JSON snapshot). Preserve existing
source/destination columns and stop-after-failure behavior. Unrelated domain,
lease, cancellation, policy and database errors keep existing handling. The
operation label describes the requested stage/finalize/check context, not a claim
about which syscall ran or what mutations completed.

Current shared redaction masks descriptor path fields by key, even after settings
change. Newly recorded selected failures therefore retain useful explanation
without depending on a configured-root history. This does not rewrite old rows or
cover every filesystem producer. Authorized file-repair detail views still have
their existing explicit path fields; support diagnostics use the shared redactor.

## Alternatives, pros/cons and final stack

| Approach | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Parse native error messages | Small patch | Version-dependent wording, ambiguous paths and secret reflection | Reject |
| Remember historical roots | Can mask some old paths | Sensitive mutable history; aliases and bounds remain problematic | Reject |
| New generic error table/framework | Central persistence | Migration and broad compatibility work for two producers | Defer |
| Fixed producer descriptor in existing persistence | Stable explanation/code; path ownership; no new queries/schema | Incremental coverage; deliberately less raw detail | Adopt |

Final stack: owned producer context + finite error code → shared failure policy →
existing run/audit/import persistence → existing shared redaction → existing
administrator diagnostics/export/UI. No new service process, global singleton,
dependency, release or branch. Error codes inform explanation only; they do not
grant retry/mutation authority or change fallback, rollback or cancellation policy.

## Validation

Exercise native-code and unknown fallbacks with hostile messages/codes/properties,
Unicode/space paths, original-error preservation and path-key redaction after root
changes. Cover restore run/audit/throw/lock-release and import stage/finalize row/
result/remaining-file behavior. Use actual filesystem failures in a disposable
packaged PostgreSQL/HTTP proof; inspect persisted rows and read historical records
after changing settings. Add only cheap unit checks to the fast gate. Reuse the
existing browser regression, run one stable final fast gate, rebuild local Docker
without cache and compare runtime artifacts before retaining unrelated evidence.
