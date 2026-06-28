# Confidence-Gated Import Candidate Auto-Selection

Status: **Implemented.** This document records the design and outcome for the
first unattended acquisition bridge after slskd search response ingestion.

## Context

The local walkthrough exposed the next acquisition gap: monitored artists and
wanted releases can now search Soulseek and ingest Import Review candidates, but
the pipeline still stopped until an operator selected a candidate. Existing code
already had a selection-readiness model with `auto_selectable`, `ambiguous`,
`low_confidence`, and active-handoff states. The missing component was a small
service that trusts that model and uses the existing Import Review selection
transition.

This change implements **automatic candidate selection only**. It does not start
the download execution run automatically yet. That remains the next gated
component because it moves from review-state mutation into provider-backed file
transfer.

## Research

Official sources reviewed:

- OWASP ASVS: use explicit, verifiable security controls instead of implicit
  trust paths. Applied here by reusing the existing guarded Import Review
  transition rather than adding an alternate write path.
  <https://owasp.org/www-project-application-security-verification-standard/>
- OWASP Logging Cheat Sheet: important events should record the who, what,
  where, when, result, and reason while avoiding unnecessary full-content data.
  Applied here by persisting bounded auto-selection summaries and relying on the
  existing import-candidate event/audit writes.
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- slskd configuration documentation: API keys are secrets, can be CIDR scoped,
  and plain HTTP is not recommended. Applied here by not adding any new provider
  payload exposure or credential handling to selection automation.
  <https://github.com/slskd/slskd/blob/master/docs/config.md>
- Playwright actionability documentation: browser proof should rely on stable
  actionability and auto-waiting instead of timing sleeps. Applied to the next
  browser slice; this server slice is covered by focused Node tests.
  <https://playwright.dev/docs/actionability>

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep manual selection only | Lowest automation risk | Walkthrough still stalls after candidates are found | Rejected |
| Auto-select high-confidence candidates | Closes the candidate-selection gap; reuses existing audit/state guards; bounded blast radius | Downloads still require explicit run start | **Selected** |
| Auto-select and auto-start downloads in one change | Closest to hands-off behavior | Larger risk surface; provider transfer side effects need separate policy and proof | Deferred |
| Add a new candidate status for automatic selection | More explicit label | Duplicates the existing state machine and UI semantics | Rejected |

## Final Stack

- `src/server/import-candidates/import-candidate-auto-selection-service.js`
  - Pure evaluation helper sorts candidates by `normalizedPayload.compositeScore`.
  - Uses `buildImportCandidateSelectionReadiness` as the single source of truth
    for thresholds.
  - Selects only `pending` or `held` candidates whose readiness is
    `auto_selectable`.
  - Calls `selectImportCandidate`, preserving existing transaction, event, and
    audit behavior.
- `src/server/import-candidates/import-candidate-module.js`
  - Exposes `importCandidateAutoSelectionService` as a module-level service.
- `src/server/library/library-discovery-dispatch-service.js`
  - After successful slskd response ingestion, attempts high-confidence
    selection for that `sourceSearchId`.
  - Selection failure is non-fatal to discovery dispatch.
  - Bounded auto-selection outcome is included in run output and discovery
    search evidence.
- `src/server/library/library-discovery-request-store.js`
  - Persists `lastSearchResult.autoSelection` as JSONB with explicit casts.

## Security

- No raw slskd responses, paths, usernames, file names, or API keys are added to
  discovery evidence.
- Selection goes through the existing `pending|held -> selected` transition and
  cannot select already-active or non-reviewable candidates.
- Ambiguous candidates remain manual review even when both scores are high.
- Low-confidence and unscored candidates remain manual review.
- Automation failure records only a bounded code in dispatch output and does not
  fail search ingestion.

## Outcome

The system now bridges successful discovery ingestion into selected Import Review
state when confidence is high enough. In the walkthrough, a wanted release whose
Soulseek response creates an unambiguous high-scoring candidate should move to
`Selected for download` without the operator clicking `Select`.

The next high-value item is **confidence-gated download execution start**:
automatically queue the existing Import Review download execution run after an
auto-selected candidate, guarded by provider health, maintenance locks, per-user
preferences, and an operator-visible setting.
