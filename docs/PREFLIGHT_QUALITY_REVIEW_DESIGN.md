# Initial quality-preflight review design

Date: 2026-10-23. Follows [controlled authority qualification](CONTROLLED_PROVIDER_AUTHORITY_OUTCOME.md).

## Problem and intended behavior

Automatic library-add preparation evaluates downloaded media before allocating an apply run. A refusal currently returns still_needs_review without saving an add-blocker event. Missing Music can therefore retain a completed-download presentation without the measured refusal or its repair guidance.

Persist the initial refusal through the existing release-owned add-review model: media_verification plus an allow-listed recovery reason, a failed candidate retained for review, its required candidate event and audit in one guarded transaction. Preserve the downloaded file. Allocate no apply run, transfer, fallback consent, source penalty or retry attempt. Existing Missing Music projection, diagnostic review and audio-tool recheck remain the user journey.

## Ownership and structure

Preparation retains the evaluated quality decision separately from its boolean eligibility result. Only a real negative quality gate can request a durable review; an unready preview without a quality decision cannot invent an audio failure.

Extend the existing prepared-add guard with a review mode. Reuse maintenance, account, wanted/discovery, apply-creation and candidate/file/decision locks. Re-read the owned release and compare candidate, participant policies and file decisions with the pre-inspection snapshot. A changed owner, search, policy, file decision or active apply run refuses the stale publication. A small ESM service classifies bounded reasons and delegates to the existing candidate transition with the owning queryable, making required audit failure roll back the whole stop. Advisory Activity is attempted only after commit.

The review is conservative historical evidence, not a grant to copy files or lower quality. Audio measurement remains outside the short transaction. Concurrent repeated publication must yield one durable transition; rereading a failed candidate must not append another refusal. Existing recheck admits repaired tooling only after fresh quality and file checks. Suspicious lossless and below-minimum media remain review-only decisions.

## Validation and deployment

Prove current refusal, bounded public projection/action, retained source bytes, no queued work, replay, disabled/missing/shared recipients, policy/provenance drift, held-lock revalidation and required-event/audit rollback with real PostgreSQL. Prove the rendered Missing Music guidance using the actual detail projection. Keep initial preflight refusal distinct from changed-source worker qualification: worker tests admit valid disposable media before restoring rejected bytes, without reopening a rejected candidate through fixture SQL.

Run focused checks first, one full fast gate, affected integration/browser and packaged media lanes. Rebuild the local walkthrough without cache while preserving its administrator, data and all five mounts. Compare exact runtime/source bytes before retaining unrelated native memory qualifications. Work on main; no release or version change.
