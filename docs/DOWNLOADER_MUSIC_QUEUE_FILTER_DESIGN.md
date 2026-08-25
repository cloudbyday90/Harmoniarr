# Downloader Music Queue Filter Design

## Decision

Add a client-only **Only transfers linked to Music Queue** filter beside the
existing Downloader state filter. The controls are deliberately separate:

- **State** is a mutually exclusive native select.
- **Only transfers linked to Music Queue** is an independent native checkbox.

Together they support the operator question, “Which queued or active transfers
belong to a Music Queue release?”, without changing the server queue query,
storing a preference, or collecting interaction telemetry.

## Why this is the next slice

The prior Downloader-to-Music-Queue handoff lets an operator follow an
individual linked transfer. This filter provides the complementary collection
view when several transfers are live. It is intentionally constrained to the
durable `diagnostics.importLinkage.musicQueueRelease.wantedReleaseId` already
present in the Downloader response; it does not infer a relationship from a
filename, artist, or release title.

## Accessibility and interaction model

The filter control is a semantic `fieldset` with a legend, an explicitly
labelled native `select`, and a labelled native `checkbox`. This follows W3C
guidance to group related controls and associate visible labels with form
controls. A visually-hidden status message announces the resulting count only
when an operator changes a filter, rather than announcing every five-second
queue refresh.

Keyboard behaviour remains native: Tab reaches each control, Space toggles the
checkbox, and the select retains the browser and assistive-technology behaviour
users expect. The compact desktop layout becomes a 44 px touch-target layout at
the small-screen breakpoint.

## Alternatives considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Do nothing | No new control | Linked transfers remain hard to triage in a busy queue | Rejected |
| Add “Linked” as a state tab | Small visual change | Incorrectly treats a relationship as a mutually exclusive transfer state | Rejected |
| Native select plus independent checkbox | Clear conjunction, semantic controls, no new server state | Adds one compact control | Chosen |
| Persist the preference or add analytics | Could remember a niche preference | Unnecessary local-hosted data retention and privacy surface | Rejected |

## Security and data handling

Filtering operates on the already-rendered, user-scoped Downloader response.
No API contract, authorization decision, database table, browser storage value,
URL query parameter, telemetry event, or background job is added. The UI shows
the Music Queue condition only when the server has supplied the durable wanted
release identifier; it never creates linkage client-side.

## Implementation boundaries

- Keep the logic in a small ESM presentation helper so it can be unit tested
  without Vue.
- Keep form rendering and event forwarding in a dedicated Downloader component.
- Keep `DownloaderView` responsible only for local view state and announcing a
  user-initiated filter change.
- Preserve existing transfer detail and direct Music Queue handoff behaviour.

## Sources

- [W3C WAI Forms Tutorial: Grouping Controls](https://www.w3.org/WAI/tutorials/forms/grouping/)
- [W3C WAI Forms Tutorial: Labels](https://www.w3.org/WAI/tutorials/forms/labels/)
- [W3C WCAG Understanding: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- [W3C WCAG 2.2: Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html)

## Next recommended item

Run a short operator usability check at desktop and narrow widths with several
linked and unlinked transfers. Do not introduce persisted filters, new sidebar
destinations, or additional queue controls unless that check reveals a concrete
decision the current handoff and filter cannot support.
