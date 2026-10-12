# Operator track override acquisition consent

October 12, 2026, America/New_York. Continues the
[monitoring opt-out outcome](OPERATOR_MONITORING_OPT_OUT_OUTCOME.md).

## Problem and decision

The planner treats any override as explicit acquisition intent. A suppression
(`isDesired: false`), desired override requiring review, or orphaned override can
therefore bypass manual-only, track-only, future and monitoring policy gates.
Reproduce valid canonical saves through the current queue and SQL publication
before changing runtime behavior. Descriptive override counts must stay intact.

Introduce a narrow ESM track consent policy and a `resolvedDesiredCount` in the
effective release group's override summary. Count only `isDesired === true` and
`remapStatus === 'resolved'` overrides. A bound `metadataReleaseId` must match the
currently resolved edition; a null/absent binding retains existing group-scoped
intent. No resolved target means no grant. Require a positive safe integer count
in the planner; old total/desired counts must not fall back to granting consent.
The counter is derived from saved normalized intent, not proof of live track
membership or catalog remapping. Existing save identity validation remains.

The planner, Wanted projection and final transaction guard reuse this decision.
Keep explicit selected/partial release-group selections independent. Suppression
does not veto separately granted broad policy or a manual release selection;
its downstream per-track meaning is a distinct contract. Existing requests and
acquired media are preserved. No release-wide cancellation or data migration is
part of this correction.

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Any override / positive desired count alone | Minimal code | Suppression or unresolved/cross-edition intent can grant policy exceptions | Reject |
| Disable all track-derived exceptions | Conservative publication | Breaks resolved desired intent and existing manual workflows | Reject |
| Positive resolved intent tied to current target | One reusable decision; deny uncertain grants; retain valid exceptions | Summary adapters must supply the new count; edition changes need retargeting/review | Select |
| Full track membership and per-track acquisition enforcement | Stronger scope throughout acquisition | Requires catalog identity/remapping and candidate/import contracts beyond this fix | Next analysis |

Recommended stack: normalized scoped save → target-specific consent summary →
shared eligibility → transaction-owned source/target rechecks → atomic request/
event → returned worker drainage. Existing writer admission, actor/acquisition
checks, cancellation and single-client transactions remain required. No new
singleton, endpoint, schema, queue, branch, release or PR merge is needed.

The scoped-overrides workflow also requires tracing effective consumers. This
slice controls whether saved operator intent grants a publication exception;
existing recipient/link-owned quality preferences and shared participants retain
their separate owners. Do not copy this summary count into shared discovery as
another recipient's consent. No downstream preference or quality override changes
are made, and exact per-track acquisition behavior is not claimed.

## Validation and ownership

Use focused tests for suppression, mixed polarity/remap state, old/malformed
summary counts, bound/unbound/other-edition intent, absent resolved target,
explicit selected/partial/unselected selection, existing blockers and normal
policy. Native cases use real saved identity and metadata, assert Wanted reads
on owned transaction clients, await worker completion/close and inspect request,
event and discovery rows. A caller-forged eligibility/explicit flag must refuse
against unchanged suppression source. Preserve positive resolved overrides,
explicit release selections, ordinary broad policy and existing requests.
Extract a reusable native execution fixture to avoid duplicating the opt-out
worker owner. Run one stable complete fast gate and one affected serial native
cohort. Record reproduced failures independently of final proof.

See [official practices](OPERATOR_TRACK_CONSENT_RESEARCH_2026_10.md).
