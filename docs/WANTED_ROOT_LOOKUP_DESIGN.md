# Wanted root lookup profiling and bounded consolidation

October 2026. Baseline main `7848883`. The separate research/outcome documents
record primary-source applicability, measurements and final validation.

## Scope and selected experiment

Wanted's existing diagnostics show seven projection reads and fourteen hashes
for two healthy receipts. Inspecting the root resolver identifies two SQL reads
per root check: all settings, then one delivery owner. Do not infer their cost
from earlier whole-reconciliation timings. Add fixed reader phases and measure
actual query counts/durations through a fixture-owned same-client adapter.

Evaluate a narrow joined read of the exact owner and optional `paths.music`
setting. Preserve missing-setting default behavior versus explicit JSON null,
disabled/missing owner refusal, current realpath containment and filesystem
failure semantics. Keep explicit settings and custom settings-loader injection
on the existing path. Read fresh context on every receipt; no root/hash memo,
cross-owner grant, query parallelism, extra checkout or new worker.

The store owns parameterized SQL and raw rows; the delivery service owns default
setting resolution and root policy. A single statement reduces the two-statement
observation window while preserving all subsequent private-root/file checks.
No schema or migration is needed. Enable the default only after identical-result
and adverse controls plus measured query reduction support the change.

## Measurement contract

Use real two-owner saved scopes and actual apply-produced tagged FLAC. Add
controlled historical receipt candidates at increasing counts, preserving current
scope/files and candidate-owned ledger triggers. This measures duplicate
historical evidence, not a larger distinct-track acquisition feature. Alternate
legacy/consolidated order on the same transaction and fixture. Compare identical
projection DTOs, hashes, root calls and actual bytes. Record raw samples, fixed
phase totals and query counts without paths/SQL/domain IDs/raw errors.

Use small two-second tonal media and larger thirty-second noise FLAC; both are
controlled signals, not all real music libraries. Profile one projection at a
time rather than multiplying a scaling benchmark by every publication recheck.
Retain the existing real full-reconciliation late-byte/event rollback controls.
No elapsed-time test threshold, forced planner/index, cold-cache or CI speed claim.

An initial large-profile timeout exposed missing benchmark drainage. Each actual
app scenario must be registered through completion; serial admission and suite
cleanup await those handles even if the test runner returns early after timeout.
Cooperative cancellation stops new queries/hashes, awaits admitted work and
returns the original reason. Retain four alternating timed samples per variant;
the real apply already hashes the files, so two extra warm-up projections are
redundant. Preserve the original failed run separately and keep scenario/pool/
teardown bounds unchanged. This experiment is not a portable performance gate.

## Alternatives

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| One fresh owner/root-setting statement | Fewer round trips and unrelated settings rows; consistent statement observation | New store contract and explicit missing/null default handling | Adopt after measured result/query proof |
| Cache roots or file hashes across receipts/guards | Less lookup/I/O | Can miss changed owner/root/bytes at a protected boundary | Reject |
| Whole-projection multi-owner batching | Potential larger query reduction | Larger policy/capture-order change and owner isolation proof | Defer until attributed scaling evidence |
| Fixed per-reader phases and same-client profiling | Separates database, root and hash work | Enabled diagnostic overhead and controlled fixture limits | Implement |

Recommended stack: current guarded transaction → parameterized fresh root context
→ existing default/private-root policy → fresh actual-file verification → bounded
phase/query/byte measurement. Preserve maintenance/acquisition/current scope and
required event rollback. Freeze reviewed ESM code for fast and affected serial
native gates, commit/push on main; no release or PR merge.
