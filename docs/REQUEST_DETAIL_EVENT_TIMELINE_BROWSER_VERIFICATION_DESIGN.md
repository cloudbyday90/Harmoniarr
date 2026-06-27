# Request Detail Event Timeline Browser Verification

## Status

Implemented in June 2026.

## Problem

Requester Request Detail already had browser coverage for submit handoff,
successful cancellation, transient cancellation failure, and stale cancellation
conflict recovery. The remaining unverified read surface was the durable event
timeline. That timeline can expose cancellation, reassignment, and future
fulfillment events, so the browser contract needed to prove:

- Requester-visible labels and descriptions are understandable.
- Reassignment fallback copy does not expose raw internal user IDs.
- Initial detail events and `Load more events` pagination follow the production
  `/media-requests/:id` and `/media-requests/:id/events` contract.
- The timeline is discoverable through role-first locators.

## Official Sources Reviewed

- Playwright locators: https://playwright.dev/docs/locators
- Playwright best practices: https://playwright.dev/docs/best-practices
- Playwright assertions: https://playwright.dev/docs/test-assertions
- Playwright actionability: https://playwright.dev/docs/actionability
- WCAG 2.2 status messages: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- WCAG 2.2 error identification: https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html
- WAI-ARIA feed pattern: https://www.w3.org/WAI/ARIA/apg/patterns/feed/
- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

## Recommendations

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Use role-first Playwright locators for the timeline and button states | Matches user-perceived UI and resists CSS churn | Requires accessible names on lists and controls |
| Keep request-event presentation in pure ESM helpers | Unit-testable, reusable by Request Detail and admin reassignment UI | Requires compatibility wrappers for existing reassignment imports |
| Use requester-safe fallback labels instead of raw user IDs | Reduces accidental data exposure and confusing copy | Some unknown reassignment events become less specific until the API supplies names |
| Seed event pages in the browser metadata fixture | Exercises production-shaped detail and cursor endpoints | Adds fixture state surface that must stay synchronized with API shape |

## Final Recommendation Stack

- `RequestEventTimeline.vue` should render event history as an accessible named
  list and use generic request-event presentation helpers.
- `request-music-form.js` should own request-event labels, tones, and
  descriptions as pure ESM helpers, with reassignment helpers retained as
  compatibility wrappers.
- Browser fixtures should seed event history per media request, including older
  cursor pages, so browser verification covers the actual detail read path.
- Browser tests should assert both positive copy and negative leakage checks for
  raw fixture user IDs.

## Implementation Outcome

- Added generic request-event presentation helpers:
  `getRequestEventLabel`, `getRequestEventTone`, and
  `formatRequestEventDescription`.
- Kept existing reassignment helper exports while delegating them through the
  generic request-event helpers.
- Updated `RequestEventTimeline.vue` to use request-event helpers and expose
  `aria-label="Request event history"` on the ordered list.
- Extended `testing/browser/metadata-browser-fixtures.js` with
  `seedMetadataMediaRequestEvents`, per-request event fixture state, and
  production-shaped event pages for both Request Detail and load-more reads.
- Added
  `test/browser/request-detail-event-timeline-browser-verification.test.js` to
  verify cancellation, creation, and paginated reassignment events as a
  requester.
- Added unit coverage for request-event labels, tones, cancellation copy,
  creation copy, and raw-ID-safe reassignment fallback copy.

## Security Notes

The timeline helper now avoids falling back to internal user IDs when a
requester sees reassignment events without an eligible-user map. This follows
least-privilege UI disclosure: the event remains useful while hiding details
that are not required for the requester workflow.

## Next High-Value Item

Validate Request Detail fulfillment pipeline event and status parity in the
browser. The event timeline can now show durable history safely; the adjacent
risk is drift between fulfillment pipeline cards, request journey stages, and
event history as discovery/import work starts, fails, or completes.
