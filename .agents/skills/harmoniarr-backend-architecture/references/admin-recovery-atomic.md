# Atomic admin recovery

Use when changing operator-armed recovery completion, account/session persistence
or attempt ownership. The [design](../../../../docs/RECOVERY_ATOMIC_DESIGN.md) and
[outcome](../../../../docs/RECOVERY_ATOMIC_OUTCOME.md) own this boundary.

Maintenance activity rows are not unique single-use claims. Keep their visible
lifecycle, but use a borrowed-client transaction for account, session, run and
success-audit writes. Pass that same queryable through every store/audit call;
pool queries inside a transaction can escape rollback.

Hash passwords before borrowing the transaction client. Preparation is not
authority: acquire the maintenance table guard before run/account row locks,
lock the originally observed run, then reread current state and database wall
time after waiting. Never retarget a pending request to a replacement run. Use
`clock_timestamp()` for expiry; transaction-start `NOW()` is stale after waits.
Check the final conditional consume result and roll all writes back on refusal.

Commit deliberate wrong-code attempts and threshold invalidation before returning
their API refusal. Throwing that refusal from the transaction would undo the
budget. Operational failure must roll back account/session/run/audit projections,
including failure after an actual write. Preserve the primary Error/null through
rollback and maintenance cleanup. A release or uncertain COMMIT failure after
durable success does not authorize automatic POST retry.

Qualify actual overlap with an independently observed native row wait, one winner
and one refusal. Cover rollback at each write boundary, existing-account flags,
replacement/expiry during preparation, expiry after waits, attempt exhaustion and
maintenance ordering. Compare sensitive projections by private digests; never log
recovery codes, plaintext passwords or stored credential hashes. Arm only a fresh
disposable fixture. Keep service proofs, route/browser refusal behavior and
preserved Docker readiness separate; do not infer remote exploitability or full
accessibility conformance from this qualification.

For arm/force-rearm/cancel, read the operator
[design](../../../../docs/RECOVERY_LIFECYCLE_DESIGN.md) and
[outcome](../../../../docs/RECOVERY_LIFECYCLE_OUTCOME.md). A row lock cannot own the
absence of a run: use maintenance-before-transaction-advisory-before-row ordering.
Keep replacement, cancellation and audits atomic, check maintenance before
cancelling valid material, and reread expiry after waits. Derive a new window from
database wall time after admission, rather than an earlier caller clock.

The partial unique armed-state index is an independent database guard, not a
substitute for atomic command policy. Refuse migration over ambiguous armed data;
do not silently choose a code to invalidate. Regenerate the snapshot and prove
incremental/snapshot anchors plus direct bypass-writer refusal. Qualify empty
admission waits, rollback after real writes, both completion/cancellation orders
and CLI consumers. Do not convert lost command-output material into an automatic
retry. Preserve transaction Error/null through the CLI boundary as well.

For CLI result delivery, use the standards skill's
[delivery reference](../../harmoniarr-web-standards/references/cli-result-delivery.md).
Keep committed service success separate from failed output/cleanup and never
automatically replace material because its one-time handoff was uncertain.

The migration scaffold now uses the canonical SQL copyright helper. Follow the
[authoring outcome](../../../../docs/MIGRATION_SCAFFOLD_OUTCOME.md): validate a
new scaffold with actual copyright/filename consumers before costly native work.
Preserve exclusive creation and applied SQL checksums; do not bulk-edit historical
migrations to repair a generator defect. The lifecycle outcome retains its earlier
header failure separately from final checksum qualification.
