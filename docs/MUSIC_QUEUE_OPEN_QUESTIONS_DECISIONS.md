# Music Queue Open Questions Decisions

Status: **Accepted for Phase 1.**

Date: 2026-06-28.

This document closes the architecture-impacting open questions from
[ACQUISITION_PIPELINE_REDESIGN_PLAN.md](ACQUISITION_PIPELINE_REDESIGN_PLAN.md)
before Phase 1 refactoring starts. These decisions prevent the read model,
routes, labels, and tests from being built against unsettled product boundaries.

---

## 1. Decisions Required Before Refactor

| Question | Decision | Rationale | Phase 1 impact |
| --- | --- | --- | --- |
| Should Music Queue replace the current user-facing `Wanted` and `Candidates` pages? | **Music Queue becomes the primary user-facing release progress surface.** Wanted remains a durable ledger. Candidates move to diagnostics. | Users think in releases they want added, not candidate rows. Wanted is still useful state, but it should not be the main progress UI. | Build rows around wanted releases. Do not expose candidate IDs in the primary payload. |
| Should Music Queue be top-level nav, Home panel, or both? | **Both.** Music Queue becomes a top-level route. Home may show a compact panel with `See all`. | The queue is important enough to find directly, while Home benefits from a quick status summary. | Add route and nav skeleton in Phase 1 or Phase 2. Read model should support summary and full list shapes. |
| Which Activity tabs survive as user-facing tabs? | **Activity defaults to timeline/history.** Operational tabs move to owner surfaces or diagnostics. | Activity should explain what happened, not become the control center. | Phase 1 read model should not depend on Activity tab ownership. Activity links point into Music Queue, Downloader, Settings, Artist Detail, Library, or diagnostics. |
| Should Activity default to a single timeline with filters? | **Yes.** Timeline first, with filters for downloads, audio checks, library adds, requests, artist policy, setup, and failures. | A filterable timeline is easier to diagnose than many workbench tabs. | Event payloads need stable event types, filter categories, and safe route targets. |
| What are the default quality profiles? | **Start with three profiles:** `lossless_archive`, `high_quality`, and `any_available`. | Three profiles cover the practical home-user cases without creating a premature matrix of options. | Quality policy service should encode these three first and keep the shape extensible. |
| Should fallback below preferred quality be per-user, per-artist, per-release, or per-profile? | **Per-profile default first, with per-release override later.** | Profile-level behavior is predictable and testable. Per-user/per-artist rules can layer on after the pipeline works. | Phase 1 quality payload includes profile fallback fields. Phase 3 can add per-release override actions. |
| Should cutoff quality trigger future upgrade search after lower-quality import? | **Yes, when `upgradeAllowed` is true and cutoff is not reached.** | This mirrors Arr-style quality cutoff behavior and keeps `High quality` useful when lossless is preferred but lossy fallback is accepted. | Read model must distinguish `in_library` from `in_library_below_cutoff` or include `cutoffReached: false`. |
| Should folder setup be required before search or before download enqueue? | **Require provider health before search; require folder setup before download enqueue.** | Searching can be useful for discovery, but downloading without a visible completed-download path creates confusing import-pending blockers. | Status projection should show `needs_setup` before download handoff when download folders/music roots/media tools are missing. |
| Should automatic library add be global, per-library, per-user, or per-artist? | **Global safe-default for now, gated by profile/library safety.** | The first version should be understandable: safe things can add automatically; unsafe things stop. Fine-grained policy can come later. | Phase 1 payload includes `autoAddEligible` and blocker reasons. Phase 4 enforces the mutation behavior. |
| What is the default for low-confidence results? | **Stop as `pick_match`. Do not auto-reject by TTL in Phase 1.** | Low-confidence results need explainability, and auto-reject introduces hidden behavior before the workflow is proven. | Status projection maps low-confidence, unscored, or ambiguous candidate evidence to `pick_match`. |
| How much old Import Review runway remains visible? | **Keep it available as operator-only advanced diagnostics during migration.** | Existing diagnostics are valuable while the Music Queue proves out, but they should not be primary UI. | Keep old routes reachable. Link from `Show advanced diagnostics`; avoid normal-path nav emphasis. |
| Should candidate diagnostics be operator-only? | **Raw candidate diagnostics are operator-only. Requesters may see simplified match history only through request/release context.** | Raw candidates expose implementation detail and provider evidence that is not useful to requester workflows. | Phase 1 route targets must distinguish simplified match detail from raw diagnostics. |

---

## 2. Deferred UI Decisions

These decisions do not block Phase 1 because they affect presentation, not the
read-model contract:

| Question | Deferred default | When to decide |
| --- | --- | --- |
| Should match detail open inline, in a side panel, or in a route-backed page? | Use a route-backed detail for accessibility/deep links; allow a drawer later. | Phase 2 UI build. |
| What exact summary cards appear on Music Queue? | Use status totals: waiting, active, needs help, in library. | Phase 2 UI build. |
| How much old Import Review runway is visible by default? | Hide from primary UI; expose under `Show advanced diagnostics`. | Phase 2/6 migration. |
| Should Wanted remain a visible secondary page? | Keep as secondary/diagnostic until Music Queue proves the workflow. | Phase 6 cleanup. |

---

## 3. Locked Route Ownership

| Surface | Owns | Does not own |
| --- | --- | --- |
| Music Queue | Desired release progress, next action, stopped-state repair, match/quality/add blockers. | Raw candidate workbench controls. |
| Downloader | Live transfer state and transfer-specific actions. | Release policy, quality cutoff, or library-add decisions. |
| Activity | Timeline, history, failures, audit trail, and handoff links. | Normal download operation. |
| Artist Detail | Monitoring policy, release/track overrides, reconciliation retry context. | Live queue operation. |
| Settings | Provider, folder, media tooling, and trust-policy configuration. | Per-release progress. |
| Library | Completed music and final availability. | Search/download/import control. |
| Advanced diagnostics | Raw candidates, operation runs, source-user trust tools, blocklist/ignored state, import runway. | Happy-path user workflow. |

---

## 4. Phase 1 Build Consequences

Phase 1 should now build only read-only, modular pieces:

1. A release-centered status projection service.
2. A quality policy service with the three locked profiles.
3. A Music Queue row read service over existing tables.
4. Presentation helpers for labels, tones, next actions, and progress steps.
5. Focused tests for each accepted decision and Phase 0 walkthrough payload.

Phase 1 should **not**:

- rename or delete Import Review
- remove Activity tabs
- enable new automatic mutations
- add schema unless the read projection cannot be derived safely
- expose raw candidates in the primary Music Queue payload

