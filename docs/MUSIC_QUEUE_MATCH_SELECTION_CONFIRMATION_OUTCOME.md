# Music Queue Match Selection Confirmation Outcome

Date: 2026-08-25

## Delivered

Music Queue now opens a shared confirmation dialog before saving a manually
chosen match. It names the release, states the bounded next effect, and offers
two clear actions:

- **Keep reviewing** closes the dialog without sending a selection request and
  returns keyboard focus to the originating match action.
- **Use this match** sends the existing selection mutation. The release then
  continues through its server-reported automatic handoff state.

The confirmation is intentionally a plain confirm/cancel dialog rather than a
checkbox gate. Selecting a reviewed candidate is meaningful, but it is not an
irreversible deletion and the extra acknowledgement would slow repeated,
informed review work without adding a distinct safety control.

## Outcome

Pros:

- Makes the release-specific consequence clear before the mutation.
- Gives mouse, keyboard, and assistive-technology users the same visible
  cancellation path.
- Keeps the decision in Music Queue and preserves focus when cancelled.
- Reuses existing accessible modal and mutation security controls.

Cons:

- An intentional selection requires a second activation.
- The dialog describes only the bounded next step; the later release state
  remains the authoritative source for download progress.

## Validation

The focused client test covers release-title and fallback copy. The focused
browser workflow covers all of the following with role-based locators:

- opening the labelled dialog from **Use this match**;
- cancelling without sending the selection request and restoring focus;
- confirming before the request begins; and
- retaining existing success, failure, and automatic-handoff feedback.

The following checks passed on 2026-08-25:

- `node --test test/client/music-queue-match-selection-confirmation-presentation.test.js` — 2 tests
- `node --test --test-concurrency=1 test/browser/music-queue-release-row-hierarchy-browser-verification.test.js` — 7 tests
- `npm run validate` — full lint, ESM, schema, unit, integration, and build validation
- `npm run validate:security` — compose policy checks and npm audit with 0 reported vulnerabilities

## Next recommended item

After an operator has reviewed and intentionally chosen a real local candidate,
verify the persisted Music Queue-to-Downloader link with the strict provider
acceptance check:

```powershell
npm run validate:docker-provider-acceptance -- -- --require-accepted-transfer --require-music-queue-link
```

That step deliberately requires an operator-selected candidate because it can
create external peer-to-peer work; this UI change does not choose or submit one
automatically.
