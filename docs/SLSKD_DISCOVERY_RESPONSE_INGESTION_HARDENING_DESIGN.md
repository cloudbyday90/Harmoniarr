# slskd Discovery Response Ingestion Hardening Design

Date: 2026-06-28

## Outcome

Local walkthrough testing showed that monitored artists did create Wanted rows
and discovery searches, but Harmoniarr could record `0` Import Review candidates
even when slskd later logged provider responses for the same query.

The root cause was the search-response handoff timing:

1. Harmoniarr started a slskd search.
2. Harmoniarr immediately read `/responses`.
3. slskd had accepted the search but had not populated responses yet.
4. Harmoniarr recorded `no_provider_responses`, moved the Wanted row to
   cooldown, and skipped Import Review candidate creation.

The import candidate service now waits briefly for asynchronous slskd search
state to expose responses before normalizing and storing candidates.

## Recommendation

Keep the wait at the import-candidate ingestion boundary, not in the UI.

Pros:

- Fixes every ingestion caller, including automatic discovery and manual ingest.
- Keeps provider timing details out of Wanted and Import Review views.
- Preserves existing diagnostics when the provider truly returns no responses.
- Remains testable through injected polling and sleep dependencies.

Cons:

- A real no-response search now takes a bounded wait before being marked empty.
- Provider-specific behavior remains in the slskd-backed ingestion path.

## Final Stack

- `src/server/import-candidates/import-candidate-service.js`
  - Adds bounded polling through `getSearchState({ includeResponses: true })`
    after an initially empty `/responses` read.
  - Returns state responses as soon as they are available.
  - Falls back to the existing zero-response diagnostic path when the wait
    expires or slskd confirms a complete empty search.
- `test/server/import-candidate-service.test.js`
  - Adds regression coverage for an initially empty response read followed by
    populated search-state responses.
- `src/client/composables/useArtistDetail.js`
  - Clears `isLoading` in a `finally` block so artist detail cannot remain on
    the loading card after unexpected loader errors.
- `test/client/useArtistDetail.test.js`
  - Adds regression coverage for unexpected loader failures.

## Security Notes

- The new diagnostics continue to store counts and reason codes only.
- No raw slskd response payloads, uploader names, file paths, API keys, or local
  filesystem mappings are written to Wanted evidence.
- Polling is bounded and only uses the already configured slskd service client.

## Automation Boundary

After this fix, successful discovery searches should create Import Review
candidates. The current product workflow still requires an operator to select a
candidate and start the download/import runway. Fully automatic
search-download-import remains a separate policy-controlled enhancement.
