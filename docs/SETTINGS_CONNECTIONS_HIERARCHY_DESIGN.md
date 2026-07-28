# Settings Connections Hierarchy Design

Status: **Implemented.**

## Problem

The Connections page presented the Soulseek ownership decision and its runtime
health in separate, equal-weight cards. This made a common task look like two
workflows: choose and save the provider configuration in one place, then find
the result and test action in another. Supporting services such as MusicBrainz
and media tooling were also always visible even though they do not change how
an operator configures the download provider.

The result was needlessly busy on a page that should answer three questions in
order:

1. Who owns the download service?
2. What must I save to use it?
3. Is the saved connection ready?

## Research

Sources were checked on 2026-07-28 against the requested June 2026 baseline.

| Source | Applied guidance |
| --- | --- |
| [W3C WCAG 2.2 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Keep the DOM and visual sequence aligned: provider choice, required fields, saved connection state, then supporting diagnostics. |
| [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) | Make connection-refresh failures textual and programmatically exposed without moving focus. Keep success/error feedback specific to the test result. |
| [W3C ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Use the existing semantic disclosure button for lower-frequency supporting service diagnostics. |
| [W3C WCAG 2.2 Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html) | Keep the saved-versus-unsaved test constraint visible next to the test action rather than relying on an implicit workflow rule. |

## Options

### Keep a separate provider-health card

Pros: all dependency states are visible without interaction.

Cons: splits the only routine connection workflow, gives supporting services
equal visual weight, and separates the test action from the fields it tests.

### Hide every health state behind an advanced disclosure

Pros: minimal first viewport.

Cons: hides the connection outcome the operator needs immediately after saving
or repairing the provider.

### Consolidate the primary connection state and disclose support diagnostics

Pros: puts ownership, configuration, saved-state result, and test action in
one predictable surface; retains MusicBrainz and media-tooling diagnostics;
keeps existing routes and provider modes intact.

Cons: an operator needs one additional activation to inspect a supporting
provider that is not the download service.

## Final Recommendation Stack

1. Keep **Managed**, **External**, and **Disabled** as the first decision and
   retain their existing server-enforced behavior.
2. Keep External address/key inputs or Managed/Disabled explanations directly
   after that decision.
3. Show the **saved** Soulseek connection state and `Test saved connection` in
   the same card, with a clear instruction to save a changed address or API key
   before testing it.
4. Keep MusicBrainz and media-tooling statuses in a named `Other service
   status` disclosure. They remain discoverable but no longer compete with the
   normal download setup path.
5. Preserve named disclosures for timing, playlist behavior, and optional
   music-source credentials.

## Implementation

- `SettingsConnectionsView.vue` now has one primary Soulseek setup card rather
  than a two-column configuration and provider-health layout.
- `SettingsProviderHealthSummary.vue` is a focused component that owns the
  saved connection presentation, accessible error message, test trigger, and
  supporting service disclosure.
- `settings-connections-presentation.js` adds pure helpers for the primary
  connection summary and supporting-service filtering. No server state,
  secrets, or side effects move into the client.
- `Test saved connection` still calls the existing authenticated dependency
  health read. It tests persisted configuration only; the UI does not imply
  that unsubmitted credentials have been validated.

## Security And Accessibility

- API keys remain write-only and are never rendered in health state or test
  results.
- Managed deployment secrets remain deployment-owned; this change does not
  add Docker socket access, remote configuration writes, or secret transport.
- Disabled mode remains a server-enforced no-provider state and keeps the test
  action unavailable.
- Refresh failures render as textual `role="alert"` feedback. The specialist
  disclosure retains an explicit button, `aria-expanded`, `aria-controls`, and
  labelled region through `SettingsDisclosure`.
- The component preserves a logical keyboard order without adding custom tab
  indices or nested focusable controls. Supporting diagnostics use an inline
  disclosure treatment rather than a card inside the primary setup card.

## Verification

- Unit tests cover primary status mapping, missing/failed health snapshots, and
  supporting-service separation.
- Source contracts cover the status component wiring, saved-connection wording,
  error semantics, and disclosure boundary.
- Browser verification covers Managed, External, and Disabled mode changes and
  progressive optional-service disclosure.
- Client lint and production build verify the ESM Vue graph.

## Next High-Value Item

Run a visual hierarchy pass over **Settings > Media & storage**. It is the
next routine setup page and still combines required library/download locations,
validation results, artwork storage, and path translations in one broad form.
The high-value slice is to make required folder readiness and its validation
result primary, while retaining artwork and path-translation repair behind
clearly named supporting sections.
