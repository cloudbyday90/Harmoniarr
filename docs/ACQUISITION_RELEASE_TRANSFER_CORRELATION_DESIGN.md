# Acquisition release-to-transfer correlation design

**Status:** implemented 2026-08-26

## Problem

The Acquisition overview intentionally keeps **Release work** and **Download
progress** as separate lanes: Music Queue owns release decisions and
Downloader owns provider transfer operations. That boundary is still correct,
but a release that is already downloading forced an administrator to infer the
relationship by comparing the two lanes.

The next step is not a combined workspace. It is a narrowly scoped,
verifiable handoff for a live transfer that Harmoniarr already knows belongs
to one Music Queue release.

## Research basis

Research was checked against the following official sources on 2026-08-26.

- [W3C WCAG 2.2 — Link Purpose (In Context)](https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html)
  supports a link whose purpose is clear from its own label. **View download
  progress** remains visible text and its accessible name adds the artist and
  release, so repeated links remain distinguishable outside their row.
- [W3C WCAG 2.2 — Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels.html)
  supports labels that describe their purpose. The compact label **Download
  progress** identifies the new line as information, not a recovery command.
- [W3C WCAG — Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
  distinguishes meaningful asynchronous status from excessive announcements.
  The periodically refreshed transfer summary is ordinary row text, not a
  new live region that would repeatedly interrupt assistive technology.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends least privilege and server-side enforcement. The browser derives
  this presentation only after the existing admin-protected Downloader queue
  response is available; the server remains the authority.
- [Playwright locators](https://playwright.dev/docs/locators) supports
  role-and-name verification of the exposed handoff instead of fragile visual
  selectors.

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Merge Music Queue and Downloader | One apparent destination | Conflates release choices with volatile provider controls and makes both views denser | Rejected |
| Match releases by title, artist, or filename | Little new data plumbing | Incorrect after remasters, duplicates, provider renames, and retries; risks a misleading action | Rejected |
| Pass provider username and transfer ID through a release handoff | Opens one exact provider row | Leaks unstable provider identifiers into the release-facing route and cannot represent a multi-file release | Rejected |
| Use the existing `wantedReleaseId` import linkage | Exact durable release relation, supports one or many transfers, preserves separate workspaces | Available only after the server has recorded the linkage | Selected |

## Recommended design

1. Keep the two visual lanes and their owning workspaces unchanged.
2. Add a pure ESM presentation module that groups only `active` and `queued`
   Downloader transfers by
   `diagnostics.importLinkage.musicQueueRelease.wantedReleaseId`.
3. Never infer a relation from a filename, artist, release title, provider
   username, transfer ID, path, or candidate payload.
4. For a verified linked release, show a concise **Download progress** summary
   in its existing Release work row and replace its generic route with the
   existing release-scoped Downloader handoff.
5. Put only `wantedReleaseId` in the handoff URL. Downloader continues to
   resolve matching rows from its caller-scoped queue projection.
6. Leave unlinked transfers in the Download progress lane and do not invent a
   relation just to make every row look connected.
7. Preserve Home's release-detail destination even if transfer information is
   available: Home stays a calm overview, while Acquisition owns the
   cross-workspace orientation.

## Security and privacy boundary

The trusted flow is:

`admin-authorized Downloader queue -> server-projected wantedReleaseId -> local exact-ID grouping -> release-scoped Downloader route`

There is no new API endpoint, write, provider request, local persistence,
telemetry, filename matching, or client-side authorization decision. The
client role check avoids fetching/rendering the Downloader model for other
roles, but the existing server-side per-request authorization remains
authoritative. A missing or stale linkage renders no cross-lane handoff.

The existing direct transfer-detail action remains available only for an
unlinked transfer in the admin-only Download progress lane. The new linked
release path deliberately does not include that raw provider identity.

## Final recommendation stack

1. Retain Music Queue for release decisions and Downloader for transfer
   controls; do not merge the navigation model.
2. Use `wantedReleaseId` as the sole release-to-transfer join key.
3. Give the handoff a visible action label and a release-specific accessible
   name.
4. Surface aggregate live state (downloading/waiting counts), not provider
   diagnostic data, in Release work.
5. Verify the interface with pure unit tests and a role-and-name browser test
   that proves linked routes exclude provider username and transfer ID.
