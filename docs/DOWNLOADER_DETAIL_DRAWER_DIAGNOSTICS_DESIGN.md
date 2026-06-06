# Downloader Detail Drawer And Diagnostics Panel Design

Date: 2026-06-06

## Scope

Add a focused transfer detail surface to the dedicated Downloader page.

This phase keeps the Downloader workflow read-only:

- add a transfer detail drawer on `/app/downloader`
- extend the downloader read model with an allowlisted per-transfer
  `diagnostics` object
- expose safe provider state, queue position, timing, retry posture, and
  recommended next action
- keep provider exception text, mutation actions, and requester-visible routes
  out of scope
- avoid schema changes; diagnostics are still live provider-backed projection
  data

## Official Research Baseline

Research was performed against official primary sources available through
May 31, 2026. URLs were discovered and verified online rather than inferred.

- W3C WAI-ARIA Authoring Practices describes modal dialogs as overlaid windows
  where background content is inert, focus stays inside the dialog, `Escape`
  closes it, and the dialog container uses `role="dialog"`,
  `aria-modal="true"`, and an accessible label:
  https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- WCAG 2.2 includes target-size and input modality criteria relevant to drawer
  controls. The drawer close target should be comfortably operable, and actions
  should not rely on drag-only interactions:
  https://www.w3.org/TR/wcag/
- OWASP API3:2023 warns that APIs commonly expose all object properties and
  that sensitive properties should not be readable by unauthorized users:
  https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/
- OWASP API4:2023 warns that APIs need appropriate limits for records returned,
  execution time, memory, and provider-backed resource use:
  https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/
- OpenTelemetry semantic conventions recommend recording exceptions as
  structured diagnostic signals while choosing severity by expected impact:
  https://opentelemetry.io/docs/specs/semconv/exceptions/exceptions-logs/

## Current Problem

The Downloader queue table is intentionally dense. It shows enough information
to scan queue state, but it does not give operators a place to inspect why a row
needs attention.

Without a detail surface:

- failed rows can only show a state pill
- queued rows cannot explain whether queue position is known
- completed rows have no place to point toward import review
- future requester/candidate linkage would either bloat the table or require a
  second redesign
- diagnostics could drift into raw provider payload exposure

## Options

### Option A: Expand The Queue Table

Pros:

- smallest UI change
- no new component
- all information is visible without interaction

Cons:

- makes the Downloader table noisy
- does not scale to request linkage, retry history, or provider diagnostics
- weak accessibility fit for long structured detail content
- encourages exposing implementation fields just because there is a column

### Option B: Add A Client-Only Detail Drawer From Existing Row Data

Pros:

- keeps the table dense and scannable
- no new endpoint
- simple to implement with the current read model

Cons:

- diagnostics would be inferred in the browser
- security review still has to inspect frontend derivation rules
- future action eligibility and diagnostics would not be server-owned

### Option C: Extend The Read Model With Safe Diagnostics And Render A Drawer

Pros:

- keeps the UI table compact while making one selected transfer inspectable
- puts diagnostic copy, severity, and recommended next action in the backend
  contract
- keeps provider exception text withheld while still signaling that an error
  exists
- creates stable slots for future retry tracking, request linkage, and
  import-candidate linkage
- matches the existing live read-model architecture without adding persistence

Cons:

- still limited to live provider observation
- retry attempts and request linkage are placeholders until later phases
- adds a new component and more DTO fields

### Option D: Build A Persisted Diagnostic Store First

Pros:

- strongest long-term foundation for history, retry attempts, stale-state
  detection, and audit
- can preserve diagnostics when the provider is unavailable

Cons:

- requires schema, retention, event ingestion, and reconciliation design
- delays the immediate operator usability improvement
- risks overbuilding before action contracts and linkage contracts are settled

## Final Recommendation Stack

Use Option C for this phase.

Recommended stack:

- Backend: extend each `downloader.transfers[]` item with `diagnostics`.
- Diagnostics shape: expose `summary`, `severity`, `recommendedNextAction`,
  `provider`, `queue`, `timing`, `retry`, and `importLinkage`.
- Security posture: expose raw provider state but never raw provider exception
  text; expose only a boolean `hasProviderError`.
- UI: add a reusable `DownloaderTransferDetailDrawer` component that uses a
  native modal dialog rendered as a right-side drawer.
- Accessibility: use `role="dialog"`, `aria-modal="true"`,
  `aria-labelledby`, a visible close button, `Escape` handling, and a 44px close
  target.
- Table posture: keep the queue table compact and add one explicit `Details`
  action per transfer.
- Data freshness: bind the drawer to the selected `transferKey` so polling can
  refresh the selected transfer instead of freezing a stale copy.
- Mutation posture: keep all downloader actions disabled and read-only until
  action eligibility and operator controls are designed.

## Implemented Outcome

- Added per-transfer diagnostics to the downloader queue read model.
- Added `src/client/components/downloader/DownloaderTransferDetailDrawer.vue`.
- Added a `Details` action to the Downloader queue table.
- Kept the route surface unchanged: `GET /api/v1/downloader/queue` remains the
  single admin-only read route.
- Kept raw provider exception details out of the API and UI.

## Contract Sketch

```json
{
  "transferKey": "source-user::transfer-1",
  "state": {
    "code": "failed",
    "label": "Failed"
  },
  "diagnostics": {
    "severity": "attention",
    "summary": "The transfer failed or reported a provider error. Raw provider error text is intentionally withheld.",
    "recommendedNextAction": {
      "code": "inspect_before_retry",
      "label": "Inspect before retry",
      "tone": "danger"
    },
    "provider": {
      "name": "slskd",
      "state": "Completed, Errored",
      "hasProviderError": true
    },
    "queue": {
      "hasQueuePosition": false,
      "placeInQueue": null
    },
    "retry": {
      "status": "not_tracked",
      "attempts": null
    },
    "importLinkage": {
      "status": "not_linked",
      "requestId": null,
      "candidateId": null
    }
  }
}
```

## Security

- The drawer consumes the existing admin-only downloader route.
- Diagnostics are allowlisted DTO fields, not provider object spreads.
- Provider exception text remains withheld.
- Request and import-candidate identifiers are placeholders until an explicit
  linkage authorization contract exists.
- No mutation controls are introduced.
- The existing queue row cap and read rate limit continue to bound provider and
  response amplification.
- The drawer renders text interpolation only; no untrusted HTML is rendered.

## Validation

Validation for this phase:

- `node --test test/server/downloader-queue-read-model-service.test.js`
- `node --test test/client/downloader-detail-drawer-contract.test.js`
- `npm run lint:server`
- `npm run lint:client`
- `npm run lint:test`
- `npm run build:client`
- `npm test`
- `npm run build`

## Next High-Value Design Areas

1. **Downloader action eligibility and operator controls.** Now that the
   detail drawer has a recommended-action slot, define the actual cancel,
   retry, clear, pause, and resume eligibility contract.
2. **Requester-scoped transfer actions.** Decide which transfer actions a
   requester can perform on their own request-linked downloads without seeing
   the global provider queue.
3. **Downloader event history and audit trail.** Persist meaningful downloader
   events so diagnostics can explain how a transfer reached its current state,
   not only what the live provider reports now.
