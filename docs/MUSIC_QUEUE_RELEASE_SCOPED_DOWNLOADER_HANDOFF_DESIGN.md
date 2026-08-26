# Music Queue Release-Scoped Downloader Handoff Design

Status: Implemented

Date: 2026-08-25

## Decision

Keep Music Queue and Downloader as separate workspaces with a small,
release-scoped handoff:

- **Music Queue** owns the release lifecycle, quality policy, and the choices
  that can change a release's outcome.
- **Downloader** owns live transfer state and transfer controls.
- A release in `downloading` state exposes **View download progress**, which
  opens Downloader filtered to that one durable Music Queue release ID.
- Downloader identifies the scope plainly, offers **Open release in Music
  Queue** and **Show all transfers**, and does not expose Music Queue decision
  controls.

This is deliberately not a merge of the two views. A queue can contain many
files and provider outcomes; a Music Queue release is the user-facing
decision unit. The handoff lets an operator move between those levels without
making either page responsible for the other workflow.

## Research Basis

Research was checked against official sources on 2026-08-25.

- The link says what it does and includes the artist and release in its
  accessible name. That gives it a clear, programmatically determinable
  purpose instead of relying on the surrounding row. [W3C WCAG 2.2: Link
  Purpose (In Context)](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context)
  and [Technique G91](https://www.w3.org/WAI/WCAG22/Techniques/general/G91)
- **Download progress**, **Music Queue transfer**, and the return controls are
  descriptive headings and labels. [W3C WCAG 2.2: Headings and
  Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels)
- The handoff summary and Transfer Queue use normal semantic sections and
  headings rather than adding a redundant ARIA region. [WAI-ARIA Authoring
  Practices: Landmark Regions](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/)
- Browser verification uses role-and-name locators so the test checks the same
  exposed controls an operator uses. [Playwright: Locators](https://playwright.dev/docs/locators)

## Options Considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Merge Music Queue and Downloader | One destination in the sidebar | Conflates release decisions with volatile per-file provider operations; creates a dense, ambiguous surface | Rejected |
| Link every downloading release to the unfiltered Downloader | Minimal code | An operator still has to find the relevant transfer in a busy queue | Rejected |
| Add provider transfer IDs to the Music Queue route | Can open one exact row | Leaks provider identifiers across a release-facing boundary and becomes stale when a transfer is replaced | Rejected |
| Release-ID-scoped Downloader handoff | Focuses the live view, works for one or many transfer rows, supports a return path, and keeps the security boundary narrow | Requires a small pure route helper and one local filter condition | Chosen |

## Final Recommendation Stack

1. Use the existing app-user-scoped Downloader queue projection as the source
   of truth for live transfers.
2. Pass only `wantedReleaseId` from Music Queue to Downloader; do not include
   provider usernames, transfer IDs, filenames, paths, candidate payloads, or
   credentials in the route.
3. Filter the already authorized queue response locally by its existing durable
   `diagnostics.importLinkage.musicQueueRelease.wantedReleaseId` field.
4. Use a visible, action-specific link label and a matching accessible label.
5. State the ownership boundary in both directions: Downloader owns controls;
   Music Queue owns release decisions.
6. Make scoped empty states explain that no *live* transfer is available and
   provide a safe return to the release rather than guessing a recovery action.

## Security and Privacy Boundary

The new route is a client navigation hint, not an authorization mechanism:

`Music Queue wanted-release ID -> already caller-scoped Downloader response -> local exact-ID filter`

The server retains authorization over the queue response. The browser never
uses the query parameter to request another user's data, submit a transfer
action, infer linkage from titles or paths, write browser storage, or emit
telemetry. A malformed or stale ID simply produces a bounded empty state.

## Validation Plan

- Unit-test the pure handoff builder, query normalizer, exact-ID transfer
  filter, and review-panel copy.
- Lint all client ESM and build the client.
- Use a Docker-backed Playwright scenario with one linked and one unrelated
  transfer to verify the new link, query, visible result, hidden unrelated
  row, scoped UI copy, and native progress semantics.
- Run the existing full repository validation and security checks before the
  final commit.
