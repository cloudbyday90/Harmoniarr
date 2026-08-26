# Acquisition workspace navigation design

**Status:** approved for implementation 2026-08-26

## Correction

The existing Acquisition route is a read-only, unlisted overview. It links out
to separate **Music Queue** and **Downloader** sidebar destinations. That
coordinates the two workflows, but it does not merge them into the coherent
operator workspace requested for Harmoniarr. The local walkthrough correctly
shows this incomplete navigation model.

This design changes the *navigation boundary*, not ownership of operations:

- **Acquisition** is the single operator sidebar destination.
- **Overview**, **Music Queue**, and **Downloader** are explicit, URL-backed
  destinations inside that workspace.
- Release choices continue to live in the existing Music Queue view; live
  transfer controls continue to live in the existing Downloader view.

This is the right hybrid: Sonarr/Radarr-style release management and
SABnzbd-style transfer operations remain specialised, but users no longer have
to infer that they belong to the same process.

## Research basis

Research was checked against official sources on 2026-08-26.

- [W3C WCAG 2.2 — Consistent Navigation](https://www.w3.org/WAI/WCAG22/Understanding/consistent-navigation.html)
  requires repeated navigation to occur in the same relative order. One stable
  Acquisition entry avoids two top-level destinations for one workflow; its
  ordered sub-navigation remains predictable on every Acquisition route.
- [W3C WCAG 2.2 — Consistent Identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification.html)
  requires equivalent functions to be identified consistently. **Overview**,
  **Music Queue**, and **Downloader** name different destinations and keep
  those names unchanged wherever they appear.
- [W3C ARIA APG — Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
  specifies the keyboard and ARIA contract for a true tab widget. These views
  are separate routes with independent loading, query, and deep-link state, so
  ordinary navigation links are more truthful and avoid implementing a tab
  pattern whose panel contract does not apply.
- [W3C ARIA APG — Landmarks](https://www.w3.org/WAI/ARIA/apg/patterns/landmarks/)
  recommends a small number of meaningful landmarks. The workspace uses one
  labelled secondary `nav` inside the existing `main`, rather than turning each
  lane into an ARIA landmark.
- [W3C WCAG 2.2 — Change on Request](https://www.w3.org/WAI/WCAG22/Understanding/change-on-request.html)
  supports only user-requested context changes. Users activate a link to change
  view; background revalidation never changes the current view or focus.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends deny-by-default and server-side checks. The workspace does not
  widen Downloader access: only administrators see the Downloader link and the
  existing protected endpoint remains the authority.

## Options considered

| Option | Benefits | Costs | Decision |
| --- | --- | --- | --- |
| Keep the unlisted overview plus two sidebar items | Lowest code change | Still makes the user mentally join one workflow across three places | Rejected |
| Put all release and transfer controls in one large page | One apparent screen | Excessive density, different refresh rates, and duplicated controls | Rejected |
| One Acquisition sidebar destination with URL-backed sub-navigation | Coherent workflow, stable deep links, specialised views remain focused | Requires route aliases and navigation tests | Selected |
| Use a client-side ARIA tab widget | Familiar compact visual | Incorrect semantic model for independently routable, asynchronously loaded views; substantial keyboard burden | Rejected |

## Recommended design

1. Replace the operator sidebar's **Music Queue** and **Downloader** entries
   with one **Acquisition** entry immediately after **Discover**. It opens the
   overview.
2. Create an `AcquisitionWorkspaceView` parent that provides a labelled
   secondary navigation in this order: **Overview**, **Music Queue**, and
   administrator-only **Downloader**.
3. Mount the current read-only overview, Music Queue, and Downloader views as
   child routes. This preserves their focused data ownership and their
   independent SWR/polling lifecycles.
4. Keep the existing `/app/music-queue`, `/app/music-queue/:wantedReleaseId`,
   and `/app/downloader` URLs as immediate, query/hash-preserving redirects to
   the new nested routes. This prevents shared links, browser history, and
   stored workflow destinations from breaking.
5. Preserve the admin restriction for Downloader in both client navigation and
   the existing server-protected Downloader API. A requester sees no transfer
   navigation and remains unable to resolve the protected route.
6. Do not rename the underlying Music Queue or Downloader modules in this
   slice. They are accurate implementation and operational concepts; the new
   workspace gives them a clearer common home.

## Security and accessibility constraints

- The change creates no API endpoint, mutation, database write, or new
  provider-data exposure.
- The secondary navigation uses `nav` with an explicit accessible label and
  native links. It does not use `role="tablist"`, `role="tab"`, or
  `role="tabpanel"`.
- Links retain the router's normal browser-history behavior and have a visible
  active state. No route is selected by focus alone.
- Existing release-scoped and transfer-scoped query parameters are retained
  through legacy redirects. No raw provider identity is added to URLs.

## Final recommendation stack

1. Make **Acquisition** the only primary navigation destination for this
   workflow.
2. Use regular route links for **Overview**, **Music Queue**, and
   **Downloader**, not an ARIA tabs implementation.
3. Preserve specialised release decisions and transfer controls in their
   existing child views.
4. Preserve legacy deep links by redirecting them safely to their matching
   child route.
5. Verify navigation order, role visibility, deep-link preservation, and the
   existing browser workflows before deployment.
