# Import Candidate Selection Readiness Design

Date: 2026-06-28

## Outcome

Wanted rows now include a bounded `selectionReadiness` summary inside
`discoveryRequest.importReviewSummary`.

This closes the local walkthrough gap where discovery searches produced Import
Review candidates, but the Missing/Wanted surface still looked idle because no
candidate had been selected for the download worker yet. The UI can now say
whether a release has a high-confidence candidate ready for operator selection,
ambiguous close-scoring candidates, low-confidence candidates, unscored
candidates, an already selected candidate, or an active download/import handoff.

## Official Sources Reviewed

- OWASP ASVS:
  <https://owasp.org/www-project-application-security-verification-standard/>.
  Application security controls should be testable and server-enforced;
  selection readiness is computed server-side instead of trusting client-only
  state.
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>.
  Diagnostics must avoid secrets and sensitive provider payloads; the readiness
  summary only exposes counts and scores.
- PostgreSQL current JSON functions and operators:
  <https://www.postgresql.org/docs/current/functions-json.html>. The read path
  uses JSONB aggregate/object operations to keep the API bounded and structured.
- Playwright locator and actionability docs:
  <https://playwright.dev/docs/locators> and
  <https://playwright.dev/docs/actionability>. The next browser proof should
  assert user-facing labels and actions through stable locators instead of
  timing-dependent waits.

## Recommendation

Use a read-path readiness layer before implementing automatic candidate
selection.

Pros:

- Explains why nothing downloads after a successful Soulseek search.
- Keeps automatic selection policy centralized and testable.
- Avoids mutating candidate status or queuing downloads until ambiguity and
  threshold behavior are visible.
- Does not expose usernames, filenames, paths, raw slskd responses, API keys, or
  execution snapshots.

Cons:

- It still requires the operator to open Import Review and select the candidate.
- It adds another summary object to the wanted-release API shape.
- It does not yet prove the full click-through in a browser scenario.

## Final Stack

- Pure policy module:
  `src/server/import-candidates/import-candidate-selection-readiness.js`
- Wanted release read projection:
  `src/server/library/library-wanted-release-store.js`
- Client presentation helper:
  `src/client/lib/wanted-release-normalization.js`
- Focused tests:
  `test/server/import-candidate-selection-readiness.test.js`
  `test/server/library-wanted-release-store.test.js`
  `test/client/wanted-release-normalization.test.js`

## Readiness Policy

Default thresholds:

- minimum composite score: `85`
- ambiguity margin: `5`

Readiness codes:

- `auto_selectable`: best pending/held candidate meets the score threshold and
  is separated from the next scored candidate by the ambiguity margin.
- `ambiguous`: the best candidate meets threshold, but the next scored candidate
  is close enough to require operator review.
- `low_confidence`: candidates exist, but the best score is below threshold.
- `unscored`: candidates exist but have no composite score.
- `selected`: a candidate is already selected; the download worker owns the next
  handoff.
- `handoff_active`: a candidate is already downloading or import-pending.
- `not_reviewable`: candidates exist, but none are pending or held.

## Security Notes

- The summary is additive and read-only.
- SQL remains parameterized and derives scores from already persisted
  `normalized_payload.compositeScore` values.
- Provider secrets and raw response data are not selected, logged, or returned.
- The client treats the summary as explanatory state only. It does not make
  authorization or mutation decisions.

## Follow-Up

Add browser verification for the Wanted-to-Import Review selection handoff:

1. Seed a wanted release with high-confidence Import Review candidates.
2. Verify the wanted card says `Ready for selection`.
3. Open candidates from the wanted card.
4. Select the best candidate.
5. Verify the wanted card changes to `Selected for download` or shows an active
   download handoff once execution runs.
