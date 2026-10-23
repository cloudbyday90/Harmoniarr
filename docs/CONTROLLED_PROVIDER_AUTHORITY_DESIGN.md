# Controlled provider authority fixture design

Date: 2026-10-23. Follow-up to candidate reputation publication.

## Finding and target

The packaged pipeline currently fails before its first download with music_queue_recovery_not_current. Its initial fixture saves metadata and a global discovery row without a wanted-release recipient. Ingestion retains a Music Queue context, so the acquisition guard correctly requires a valid wanted-release authority. A role or provider search UUID cannot replace that authority.

Repair fixture inputs through saved operator monitoring and real wanted/discovery reconciliation. Keep production authorization, quality and recovery guards enabled. Separate metadata input creation, operator/monitoring setup and pipeline assertions into small ESM fixture modules. Single-owner and shared-owner scenarios must derive the same kind of authority, with exactly their intended recipients and current links. Private policy markers remain confidentiality sentinels, not consent.

## Invariants

- No positive fixture writes candidate ownership, wanted rows or discovery links as a substitute for reconciliation.
- The actual library module derives wanted/discovery state before provider ingestion. Subsequent worker reconciliation must preserve that state.
- Shared physical work retains separate operator decisions. The new packaged refusal cases remove wanted ownership, disable an owner or revoke saved monitoring after real download and apply acceptance. The actual apply worker must make no library write and issue no further transfer. Existing scoped recovery execution PostgreSQL cases separately own pre-provider refusal.
- Test setup failures remain failures. Preserve the original Error/null, drain owned work and verify temporary project retirement. Provider counters and file inventories are separate evidence.
- Historical provenance identifies the producing inputs and run; it does not authorize current work. No production bypass or additional application/service is introduced.

## Validation plan

Retain the unchanged packaged failure. Verify the new fixture with real PostgreSQL and actual library reconciliation, then run the full controlled-provider pipeline on an immutable image. Pair positive progress with missing/revoked-owner refusal and provider/file side-effect counts. Use focused checks first and a stable full fast gate once. Rebuild the local walkthrough without cache while preserving the admin, data and all five actual mounts. Compare runtime bytes so fixture-only changes do not trigger unrelated native allocation workloads.

## Current fixture contracts

Saved user quality preferences determine current recipient requirements; the monitoring acquisition-profile label does not populate them. Strict cases save lossless/FLAC, while strict shared cases combine that owner with a high-quality owner and retain the 320 kbps floor. The bounded search-stop case saves high quality for both owners so its search exhaustion can be exercised independently of a pending lossless quality choice. No derived quality evidence is patched to create authority.

Strict preflight refuses limited-bandwidth FLAC before an apply run exists. The quality cases first prove this refusal. They then copy already verified disposable media into the task-owned download, call the actual automatic-add service and restore the rejected bytes before the actual worker runs. This follows the existing file-backed fixture's changed-source pattern and preserves its fallback/exhaustion checks. It does not claim that initial preflight review automatically initiates recovery.

Manual worker driving loads saved scope, trigger source, safety mode and counts and awaits owned completion. A source-disappearance recovery uses the current terminal category import_blocked plus its specific source_path_unavailable blocker. Aggregate evidence requires these details and all three distinct authority-refusal cases.

## Boundary

These controlled HTTP fixtures establish fixture composition, application ingestion, provider handoff and real generated-media processing. They do not establish public-network discovery, native Soulseek protocol correctness, general authorization completeness or accessibility conformance.

## Exhausted scoped recovery

The repaired shared fixture exposed a runtime gap: the scoped recovery owner stopped scheduling work at the saved search cap but left its discovery request in cooldown. Persist the bounded stop in the same transaction as terminal history, attempt count, reputation publication and the recovery episode. Reuse the existing blocked/download_recovery_exhausted projection and manual restart command. A small owning store requires the same search identity and a current cap before updating; any mismatch rolls the transaction back. Current recipient, origin and discovery checks remain prerequisites, so stale owners cannot block newer acquisition.

This adds a focused runtime correction to the fixture repair. Qualification includes actual PostgreSQL update/episode rejection, rollback, replay, current-scope refusal, the packaged shared stop and racing owner restart. Existing media allocation limits are unchanged; compare exact runtime/source and rerun affected recovery/deployment checks rather than unrelated allocation workloads.
