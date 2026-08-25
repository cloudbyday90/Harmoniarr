# Acquisition overview design

**Status:** implemented 2026-08-25

## Problem

Music Queue shows the release-centred acquisition state and decisions, while
Downloader shows live, provider-centred transfer activity. Those are distinct
operational views, but a self-hosted administrator currently has to infer their
relationship by switching between two dense screens.

The first step must not turn the landing page into another queue, duplicate
mutation controls, or reveal live provider rows to users who are not already
allowed to view them. It should give an administrator one calm, read-only place
to orient themselves and then send them to the existing owning workspace.

## Research basis

Research was completed against the official sources below on 2026-08-25.

- [W3C WCAG 2.2 — Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html)
  requires repeating functionality to be identified consistently. The overview
  uses the existing **Music Queue** and **Downloader** names and links rather
  than inventing aliases for their actions.
- [W3C WCAG — Focus Order](https://www.w3.org/WAI/WCAG21/understanding/focus-order.html)
  requires a focus order that preserves meaning and operation. The DOM order is
  release work first, then download progress, which matches the operating
  sequence and visual layout.
- [W3C WAI-ARIA landmark guidance](https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/)
  recommends a small set of meaningful regions. The existing application main
  landmark remains the page boundary; cards use labelled headings instead of
  proliferating ARIA landmarks.
- [W3C WCAG 2.2 — On Focus](https://www.w3.org/WAI/WCAG22/Understanding/on-focus.html)
  prohibits changing context merely when an item receives focus. Rows are plain
  links; opening a release or transfer always requires explicit activation.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends least privilege, deny by default, and per-request authorization.
  The browser does not request Downloader data unless the current user is an
  administrator, and the existing server-side admin check remains authoritative.

## Options considered

| Option | Benefits | Costs / risk |
| --- | --- | --- |
| Replace Music Queue and Downloader with one new screen | Fewer navigation items | Moves and re-tests too many established actions; makes troubleshooting harder. Deferred. |
| Add a new combined server endpoint | One client request | Couples two read models and risks widening the Downloader authorization boundary. Deferred. |
| Add a Home dashboard panel | Easy to discover | Reintroduces the crowded home-page problem and weakens the specialised workflow boundary. Rejected. |
| Read-only client composition on a dedicated route | Reuses scoped APIs, preserves source-of-truth pages, can be tested independently | Two SWR reads and an extra prototype route. Selected. |

## Recommended design

1. Add an ESM-only `useAcquisitionOverview` composable that composes the
   existing Music Queue and Downloader read APIs with independent SWR lifecycle
   state.
2. Add a pure `acquisition-overview-presentation` module for summary cards,
   visible transfer rows, and fixed client-side limits. Keep the Vue page
   declarative.
3. Add `/app/acquisition` as a direct, read-only prototype route. Do not change
   the primary navigation in this slice. Existing Music Queue and Downloader
   headers link administrators to the overview.
4. Keep the two lanes distinct:
   - **Release work**: only active or actionable Music Queue releases, with
     links to the existing release inspector.
   - **Download progress**: only active or queued transfers, with links to the
     existing Downloader detail drawer.
5. Keep every mutation in its owner: match/recovery choices remain in Music
   Queue; transfer controls remain in Downloader.
6. Only request and render download rows for administrators. Other roles still
   receive the existing Music Queue experience; no client-side decision grants
   access to the protected endpoint.

## Security and accessibility

The design adds no endpoint, mutation, stored data, or query parameter. It
uses the pre-existing authenticated Music Queue API and admin-protected
Downloader API. The client-side role guard is a privacy-preserving fetch guard,
not an authorization mechanism; the server route continues to enforce admin
session authorization for every request.

The page uses native buttons and links, semantic headings, list structures for
rows, visible text plus semantic status pills, labelled native `progress`
elements, and polite status messages only for dynamic refresh/error feedback.
It does not move focus or navigate automatically while data revalidates.

## Non-goals

- Do not remove, rename, or redirect the existing Music Queue or Downloader
  route.
- Do not correlate a release to a transfer by filename, artist name, or another
  unsafe heuristic.
- Do not expose Downloader source-user, file, or directory data to
  non-administrators.
- Do not add controls that duplicate Music Queue recovery or Downloader actions.
