---
name: harmoniarr-product-language
description: Use this skill when writing or reviewing Harmoniarr product copy, docs, route labels, test names, component names, or code identifiers for platform terminology. Trigger when work touches Discover, Home, artist detail, monitored artists, recommended artists, requests, wanted/desired state, release or track overrides, reconciliation, Activity, Background Jobs, or legacy seed/follow wording.
---

# Harmoniarr Product Language

## Core Model

Use product language that separates durable operator intent from recommendation internals and requester actions.

- `Monitored artist`: an artist the operator has explicitly chosen to manage for release tracking, desired-state generation, recommendations, and operational workflows.
- `Recommended artist`: an artist Discover surfaces from the monitored profile and similarity sources.
- `Recommendation input`: internal algorithm term for artists contributing to recommendations. Avoid in UI unless explaining implementation.
- `Request`: a user or operator asks for media acquisition. Do not conflate with monitoring.
- `Wanted` or `desired`: saved operational state that downstream automation may act on.
- `Override`: an explicit exception to broad policy at release or track level.
- `Reconciliation`: background reevaluation that turns saved policy and selections into operational work.

## Surface Rules

Discover:

- Present candidates and recommendations.
- Use `Add artist` or `Add to monitored artists` for the promotion action.
- Do not ask users to curate seeds or a separate recommendation graph.

Home:

- Present the canonical monitored artist profile.
- Emphasize policy, coverage, progress, and operational activity.
- Keep card copy compact and scan-first.

Artist Detail:

- Present deep curation.
- Use draft language for unsaved edits.
- Make `Save` and `Cancel` the operational boundary.
- Show broad policy and manual overrides together; never hide exceptions silently.

Activity and Background Jobs:

- Use operational language: queued, running, completed, failed, cancelled, retry, reconciliation.
- Explain that a save can queue reevaluation without implying immediate downloads.

## Avoid

- Avoid user-facing `seed`, `seed artist`, `followed artist`, or `following` for the durable operator-managed set.
- Avoid using `monitor` as a requester-facing action when the user is really making a request.
- Avoid implying unchecking a release deletes acquired media. It changes future desired state only.
- Avoid success copy that promises acquisition when the system only saved policy or queued reconciliation.
- Avoid exposing table names, raw enum names, or implementation-only identifiers in UI.

## Preferred Copy Patterns

- `Your monitored artists power release tracking and recommendation discovery.`
- `Add artist`
- `Add to monitored artists`
- `Save policy`
- `Unsaved changes`
- `Latest save queued`
- `Reconciliation running`
- `Manual inclusion`
- `Manual exclusion`
- `Manual partial selection`
- `No desired releases selected yet`

## Code Naming Guidance

- Keep legacy names only when preserving existing API or migration compatibility.
- Prefer `operator`, `monitored`, `recommended`, `desired`, `selection`, `override`, `reconciliation`, and `projection` for new code.
- Use `seed` only when touching legacy implementation internals; do not introduce new public copy or APIs around it.
- When replacing legacy naming, keep edits scoped and covered by tests.

## Review Checklist

- Does the copy distinguish monitoring, requesting, wanted state, and deletion?
- Does Discover remain the add/evaluation surface?
- Does Home remain the canonical managed surface?
- Does Artist Detail make draft state and save/cancel boundaries clear?
- Are broad policy and manual overrides both visible?
- Are background jobs described as reevaluation, not guaranteed downloads?
