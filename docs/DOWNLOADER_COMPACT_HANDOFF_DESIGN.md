# Downloader Compact Handoff Design

Status: Implemented
Date: 2026-08-25

## Purpose

The Downloader table is a compact, live provider-operations view. A transfer
with a durable Music Queue association should expose that destination without
turning the row into a second release-management interface. **Details** stays
the primary operation because it explains and controls the current transfer.

The compact handoff appears only when the existing server response includes a
caller-scoped Music Queue release. It adds no fetch, mutation, provider data,
or new authorization decision.

## Research Basis

Research was checked against current official W3C guidance on 2026-08-25.

- A native HTML table remains the preferred structure for static tabular data;
  individual controls in its cells are separate keyboard stops. This supports a
  small conditional set of ordinary links rather than a custom grid or a new
  control system. [W3C APG: Table Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/table/)
- Native anchor links retain expected browser and keyboard behavior. The
  component uses Vue `RouterLink`, which renders an anchor, rather than a
  scripted pseudo-link. [W3C APG: Link Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/link/)
- Link text must state its purpose. The Music Queue link includes both its
  destination and release identity: **Open Music Queue release: Artist —
  Release**. [W3C Technique G91](https://www.w3.org/WAI/WCAG22/Techniques/general/G91)
- Keyboard focus order must preserve meaning, and focus must remain visible.
  The primary Details button precedes secondary destinations; each secondary
  link has an explicit visible focus outline. [WCAG 2.2: Focus Order and Focus
  Visible](https://www.w3.org/TR/wcag/)

## Options Considered

| Option | Benefits | Costs / risk |
| --- | --- | --- |
| Keep the handoff in Details only | Fewest table controls | Adds an unnecessary step for a common release-centred task. |
| Add a Music Queue column | Prominent destination | Widens an already dense operations table and repeats empty values. |
| Make Music Queue a second button | Large target | Incorrectly suggests an equivalent provider action and competes with Details. |
| Add a conditional secondary text link in Diagnostics | Direct, compact, keyboard-native, and absent for unlinked rows | Adds one tab stop only for durable links. |

## Final Recommendation Stack

1. Keep **Details** first and primary for every transfer.
2. Render a separate ESM `DownloaderTransferRowHandoffs` component after that
   button, keeping page orchestration separate from destination presentation.
3. Show the Music Queue link only from the existing sanitized,
   app-user-scoped `musicQueueRelease` contract.
4. Place the release-centred Music Queue destination before the more technical
   Import Review destination.
5. Use native links, destination-specific names, visible focus, a 24px
   desktop minimum target, and a 44px mobile target.
6. Do not add a column, query, mutation, background work, or custom ARIA grid.

## Security Boundaries

The row receives the same allowlisted response used by the existing detail
dialog. Client code validates a wanted-release ID before constructing a route;
an absent or non-durable association renders no Music Queue link. No provider
path, username, transfer identifier, raw candidate payload, or secret is added
to the table contract.

## Validation Plan

- Test the row-handoffs component contract and the view's primary-action order.
- Exercise the compact Music Queue link and the existing Import Review link in
  the browser.
- Run client lint/build, focused client and browser checks, full validation,
  and security validation before committing.
