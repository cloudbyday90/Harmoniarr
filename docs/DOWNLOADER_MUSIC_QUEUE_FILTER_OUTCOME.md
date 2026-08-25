# Downloader Music Queue Filter Outcome

## Delivered

Downloader now has two composable, local-only transfer filters:

- **State**: all states, active, queued, completed, or failed.
- **Only transfers linked to Music Queue**: includes only transfers with the
  durable Music Queue wanted-release identifier supplied by the server.

The visible count updates with the filtered result. When an operator changes a
filter, a polite, atomic status message announces that result count without
announcing routine five-second Downloader polling updates.

## Architecture

`src/client/lib/downloader-transfer-filter.js` is an ESM-only, framework-free
module for linkage detection, composable filtering, and count copy.
`DownloaderTransferFilters.vue` owns the native form controls and forwards
changes. `DownloaderView.vue` retains the short-lived view state and the
user-initiated status announcement.

The server queue endpoint, database schema, downloader permissions, and Music
Queue route contract are unchanged. No filter state is stored in local storage,
the URL, a database, or telemetry.

## Validation evidence

- Focused client tests cover state-only, linkage-only, combined, invalid-state,
  and durable-identifier cases.
- The component contract test verifies grouped native controls, labels, focus
  treatment, the narrow-screen touch target, and the status announcement
  wiring.
- The Playwright scenario loads one linked active transfer and one unlinked
  queued transfer, verifies state filtering, verifies the zero-result
  intersection, verifies the announced count, and restores the linked row.
- Full repository validation and the npm security validation are recorded in
  the commit handoff for this change.

## Follow-up

The next recommended item is a brief manual operator check at desktop and
narrow widths using several real linked and unlinked transfers. Keep the UI as
is unless that check reveals a decision operators cannot make through the
existing direct Music Queue handoff and this filter; do not add a persisted
filter, telemetry, or another navigation destination pre-emptively.
