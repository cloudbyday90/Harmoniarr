# Missing Music Downloader handoff design

**Status:** implemented

**Created:** 2026-08-26

## Outcome

An administrator can select **View in Downloader** from a Missing Music
release only after Harmoniarr has submitted its transfer work. Downloader then
resolves a release-scoped context on the server and shows the live transfers
for that release, together with the household user for whom it was requested.

The handoff keeps Missing Music responsible for deciding *what* to obtain and
Downloader responsible for monitoring or managing the submitted transfer. It
does not merge their two different jobs into a single crowded page.

## Problem

The existing Missing Music workflow can start a bounded download preparation,
but does not provide an understandable, safe path to its resulting live
transfer. A client-built URL containing a target user or provider transfer
identity would make the link fragile, expose unnecessary data, and risk
treating user-controlled URL state as authorization.

## Options considered

### 1. Put the target user and provider transfer identifiers in the URL

**Pros:** no additional request after navigation.

**Cons:** exposes provider-private values, lets a forged URL misrepresent who
the transfer is for, and couples a durable application route to a transient
provider transfer. Rejected.

### 2. Reuse the legacy `wantedReleaseId` URL filter

**Pros:** simple and remains compatible with existing Music Queue links.

**Cons:** does not retain a trustworthy target-user label after reload and
cannot prove that the URL represents an administrator-authorized Missing Music
handoff. Retained only as legacy compatibility.

### 3. Use an opaque decision ID and a server-resolved handoff read

**Pros:** preserves release and target-user context across refreshes; the
server authorizes every handoff read; the browser sends only one opaque
decision ID; no provider username, transfer ID, path, match evidence, or
credentials enters the URL or handoff response.

**Cons:** requires one small, read-only request when opening a handoff.

**Decision:** adopt option 3 for Missing Music. The extra read is deliberate:
it makes the contextual label durable and keeps the authorization boundary on
the server. Existing Music Queue links continue to use option 2 until their
separate retirement work is complete.

## Contract

The Missing Music inspector receives `permissions.canViewDownloader` only when
the signed-in actor is an administrator and the decision's next action is
`open_downloader`. Its visible destination link is:

```text
/app/acquisition/downloader?missingMusicDecisionId=<opaque decision ID>
```

Downloader calls this administrator-only API before it applies the filter:

```text
GET /api/v1/missing-music/decisions/:decisionId/downloader-handoff
```

The server resolves the decision against the administrator's current household
scope. It returns only the presentation facts Downloader needs:

```json
{
  "decisionId": "wanted-release-id",
  "release": { "artistName": "Autechre", "title": "Amber" },
  "requestedFor": { "username": "Jamie" },
  "wantedReleaseId": "wanted-release-id"
}
```

`wantedReleaseId` is used only to match Harmoniarr's existing server-produced
transfer linkage in the already-admin-only Downloader read model. It is not an
authorization assertion. The handoff read rejects a decision that is not in
the submitted-transfer state, so a copied or stale Missing Music URL cannot
silently become an unrelated transfer browser.

While this context is loading or unavailable, Downloader does not temporarily
apply a broad transfer view for that handoff. It explains the state and offers
an explicit **Show all transfers** action instead. This avoids an accidental
flash of unrelated household transfer information.

## Interaction and accessibility

The inspector's visible link says **View in Downloader**. Its accessible name
keeps the visible wording and adds the release and target-user purpose, for
example: “View Amber downloads for Jamie in Downloader.” The Downloader banner
states what is being shown and provides two conventional links/actions:

- **Return to Amber in Missing Music** returns to the durable decision page.
- **Show all transfers** intentionally removes the contextual filter.

This follows W3C guidance that a control's accessible name should be concise,
unique, and reflect its visible label, and that link text should identify its
destination. The presentation does not rely on color or an unexplained status
term to tell the operator what to do.

## Security model

- The browser never supplies `requestedForUserId`, provider usernames, raw
  provider transfer IDs, paths, candidate evidence, or credentials.
- The API uses the authenticated server session and administrator authorization
  for each handoff request. An opaque ID is not trusted as proof of access.
- The server derives both release ownership and target-user display context
  from the resolved decision.
- The handoff is a GET read; no CSRF-bearing mutation is introduced.
- The same `missing_music_decision_not_found` result remains used for an
  unavailable decision, limiting scope-discovery detail.

This is aligned with OWASP's deny-by-default, least-privilege, and
server-side authorization guidance. It also preserves disabled-user history:
the historical release remains visible where authorized, but a new handoff is
not offered unless its current state has a submitted transfer to view.

## Sources consulted (current 2026-08-26)

- [W3C WAI-ARIA Authoring Practices: Accessible Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)
- [W3C WCAG technique G91: Providing link text that describes the purpose of a link](https://www.w3.org/WAI/WCAG22/Techniques/general/G91)
- [W3C Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG/)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

## Verification

Focused tests must prove that:

1. only an administrator can resolve a handoff;
2. the server derives release and target-user context and excludes provider
   data;
3. a non-submitted decision cannot create an active handoff;
4. the client URL has only the opaque decision ID;
5. the visible filter, return link, and accessible name identify the release
   and target user; and
6. an existing Music Queue `wantedReleaseId` link continues to function.

The implementation also runs the repository's normal checks and rebuilds the
local walkthrough Compose stack after all checks pass.

## Follow-up

**Completed 2026-08-26:** Legacy Music Queue and interim Acquisition deep
links now redirect to their canonical Missing Music decision pages while
retaining query strings and hashes. The compatibility work remains separate
from this handoff; see [Missing Music canonical links and legacy
redirects](MISSING_MUSIC_LEGACY_DEEP_LINKS_DESIGN.md).

Next, add cross-user authorization and keyboard-inspector browser coverage,
then remove the now-unreachable legacy workspace modules in a dedicated
cleanup change.
