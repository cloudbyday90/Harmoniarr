# Confidence-Gated Download Execution Start Design

Date: 2026-06-28

## Outcome

Library discovery now continues the automation chain after high-confidence
Import Review auto-selection:

1. Discovery starts a slskd search for a wanted release.
2. Import Review ingests provider responses into candidates.
3. The existing selection-readiness policy selects exactly one unambiguous
   high-confidence candidate.
4. A new policy service verifies Library automation is enabled and slskd is
   healthy.
5. Harmoniarr starts the existing Import Review download-enqueue operation run.
6. Discovery search evidence records bounded `autoSelection` and
   `autoDownloadStart` summaries.

The implementation intentionally reuses the existing Import Review execution
runway. It does not add a parallel downloader path and does not store provider
secrets or raw slskd payloads in operation summaries.

## Official Sources Reviewed

- slskd official repository and configuration documentation:
  <https://github.com/slskd/slskd> and
  <https://github.com/slskd/slskd/blob/master/docs/config.md>. The design keeps
  Harmoniarr on API-key backed slskd integration and assumes role-scoped keys in
  deployment guidance.
- OWASP REST Security Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html>.
  The design keeps server-side authorization, validation, and state transitions
  at backend service boundaries instead of trusting client-only state.
- OWASP Secrets Management Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html>.
  The design does not log, echo, or persist slskd API keys in discovery evidence,
  operation-run summaries, or browser fixtures.
- Playwright best practices:
  <https://playwright.dev/docs/best-practices>. Existing browser coverage remains
  deterministic and role-oriented; this slice adds service and contract coverage
  first because the behavior is backend orchestration.
- Vue form handling and reactivity documentation:
  <https://vuejs.org/guide/essentials/forms.html>. The Library settings toggle
  uses a normal checkbox binding into the existing settings composable.

## Recommendations

### Option A: Reuse Import Review execution runs

Pros:

- Preserves the durable operation-run, lease, cancellation, maintenance-lock,
  audit, and Activity surfaces.
- Keeps manual and automatic starts on one tested path.
- Lets existing Downloader and Import Review diagnostics continue to explain
  provider acceptance or rejection.

Cons:

- Starts the selected-candidate queue as the existing manual action does, rather
  than introducing a candidate-scoped execution slice.
- Automatic starts may skip when another execution run is already queued.

### Option B: Directly enqueue downloads from discovery

Pros:

- Shorter path from search to slskd.
- Could enqueue only the newly selected candidate.

Cons:

- Bypasses Import Review execution diagnostics, maintenance locks, audit
  semantics, and retry/recovery handling.
- Creates a second download state machine that would be harder to secure and
  reason about.

### Option C: Keep auto-selection only

Pros:

- Lowest risk behaviorally.
- Keeps operator review as the explicit boundary.

Cons:

- Does not match the automation-first walkthrough expectation.
- Leaves Downloader idle after a high-confidence selection unless the operator
  manually starts the execution run.

## Final Recommendation Stack

- `src/server/import-candidates/import-candidate-auto-download-run-service.js`
  - Gates automatic starts on selected auto-selection results, Library
    automation setting, slskd health, and the existing execution service.
  - Returns structured skip/start evidence without throwing normal guard states.
- `src/server/import-candidates/import-candidate-execution-service.js`
  - Accepts `triggerSource`, `sourceSearchId`, and `selectedCandidateId`.
  - Stores those fields in the operation-run summary and audit details.
- `src/server/import-candidates/import-candidate-execution-worker.js`
  - Preserves trigger metadata across started, completed, paused, cancelled, and
    failed run summaries.
- `src/server/library/library-discovery-dispatch-service.js`
  - Starts the gated download run after successful high-confidence auto-selection
    and records bounded evidence in discovery search results.
- `src/server/validators/settings-validator.js`
  - Adds `library.autoStartDownloadsAfterSelection`, defaulting to `true`.
- `src/client/views/SettingsLibraryView.vue`
  - Adds an operator-facing checkbox to disable automatic download starts while
    keeping discovery and selection active.

## Security Notes

- The service does not receive or persist slskd API keys.
- Provider health evidence is limited to provider name, status, and bounded
  message/code values.
- The execution run still passes through the existing maintenance-lock guard.
- Active-run conflicts are recorded as skipped automatic starts rather than
  surfaced as noisy operator alerts.
- Discovery JSONB evidence stores only ids, run ids, source search ids, trigger
  source, and skip/error codes required for diagnosis.

## Validation

- `node --test test/server/import-candidate-auto-download-run-service.test.js test/server/import-candidate-execution-service.test.js test/server/library-discovery-dispatch-service.test.js test/server/operation-queue-handlers.test.js test/server/settings-validator.test.js test/server/app.test.js test/server/import-candidate-module.test.js`
- `node --test test/client/settings-form.test.js test/client/useSettingsForm.test.js test/client/settings-library-view-contract.test.js`

## Follow-Up

Next high-value item: selected-candidate scoped execution. Today automatic and
manual execution starts use the existing selected queue. A follow-up should add a
candidate-scoped execution option so confidence-gated starts can queue only the
newly auto-selected candidate while preserving the same operation-run,
maintenance-lock, and diagnostics model.
