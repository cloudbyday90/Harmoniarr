# Request Detail Pipeline Parity Browser Verification

## Status

Implemented in June 2026.

## Problem

Requester Request Detail had browser proof for request submit handoff,
cancellation, cancellation failure/conflict recovery, and durable event timeline
rendering. The next unverified surface was parity between:

- the fulfillment status stat,
- the Request journey stages,
- the linked import-candidate pipeline section,
- and the durable event history.

If these surfaces drift, requesters can see contradictory state such as a
queued fulfillment stat, a completed download journey, and an empty pipeline.
This is also a disclosure boundary because requester pipeline reads must not
expose source-user names, private folder paths, import-candidate IDs, or
operation-run diagnostics.

## Official Sources Reviewed

- Playwright locators: https://playwright.dev/docs/locators
- Playwright best practices: https://playwright.dev/docs/best-practices
- Playwright assertions: https://playwright.dev/docs/test-assertions
- Playwright actionability: https://playwright.dev/docs/actionability
- WCAG 2.2 status messages: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- WCAG 2.2 error identification: https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html
- MDN ARIA live regions: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions
- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

## Recommendations

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Verify status parity through browser-visible text, not implementation state | Proves the requester experience directly | Requires carefully seeded fixture state |
| Use named semantic lists for journey and pipeline candidates | Enables stable role-first Playwright locators | Requires small markup updates |
| Seed raw operator-shaped pipeline candidates, then project requester-safe payloads in the fixture | Proves least-privilege display boundaries | Adds a small projection layer to the browser fixture |
| Keep fulfillment event labels/copy in pure request presentation helpers | Reusable and unit-testable | Adds a few event-specific copy branches |

## Final Recommendation Stack

- Request Detail journey and pipeline candidate groups should be named lists so
  browser tests can use role-first locators.
- Browser fixtures should serve raw pipeline candidates through a session-aware
  projection matching the production requester/operator split.
- Request-event presentation should explicitly label common fulfillment events:
  fulfillment started, download completed, import pending, import completed,
  and fulfillment failed.
- Browser verification should assert both positive parity and negative leakage:
  no import review link, no source-user name, no private folder path, no
  candidate ID, and no operation-run ID for requester sessions.

## Implementation Outcome

- Added `aria-label="Request journey"` to the request journey ordered list.
- Converted Request Detail linked pipeline candidates to an ordered list named
  `Linked import candidates` while preserving the native `details` disclosure.
- Added fulfillment event labels, tones, and descriptions to
  `request-music-form.js`.
- Extended `metadata-browser-fixtures.js` with:
  - `updateMetadataMediaRequest`
  - `seedMetadataMediaRequestPipeline`
  - requester/operator-aware pipeline projection for seeded raw candidates
- Added
  `test/browser/request-detail-pipeline-parity-browser-verification.test.js`.
  The test seeds an import-pending request, a raw private pipeline candidate,
  and matching fulfillment events, then verifies stat/journey/pipeline/event
  parity as a requester.

## Security Notes

The browser fixture now mirrors the production pipeline projection boundary:
requesters receive safe `source-*` keys, generic `Source N` labels, basic run
status/timestamps, and transfer progress only. Operator-only fields remain
withheld from requester browser assertions, including peer username, private
folder path, import-candidate ID, operation-run IDs, status messages, and run
error diagnostics.

## Next High-Value Item

Verify the operator/admin Request Detail pipeline view. Requester parity is now
covered; the adjacent risk is that operator-visible diagnostics, import review
links, and candidate drill-through controls may drift from the requester-safe
projection or lose keyboard/focus behavior.
