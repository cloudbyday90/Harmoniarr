# Missing Music manual inclusion design

**Status:** implemented 2026-08-25
**Scope:** the first direct-selection action in Missing Music

## Problem

Missing Music accurately shows releases that are selected but not fully in the
library. Until this change, it offered only search actions. An operator could
not state, from that workspace, that an already policy-selected release must
remain selected if broad policy changes later.

The solution must not turn Missing Music into a second artist-policy editor or
write directly to a release-selection table. Doing either would allow the
desired-state, reconciliation snapshot, and Activity history to diverge.

## Research basis

Research was completed against the official sources below on 2026-08-25.

- [W3C WCAG 2.2 SC 3.3.2 — Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html)
  says controls need sufficient visible labels and instructions without adding
  unnecessary cognitive load. The action therefore says **Keep selected
  manually**, with the consequence explained only in the short confirmation.
- [W3C ARIA APG — Modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
  requires a labelled modal dialog, contained keyboard focus, a visible close
  control, and return of focus to the invoking control. The existing native
  dialog component already supplies those behaviours, so the new context
  extends it instead of introducing a second modal implementation.
- [W3C WCAG 2.2 SC 4.1.3 — Status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  calls for important asynchronous results to be programmatically available
  without moving focus. The action uses the existing toast/status mechanism
  for success and error feedback while the reconciliation projection catches
  up.
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
  recommends CSRF protection on every state-changing cookie-authenticated
  request. The endpoint requires the existing fresh-session and CSRF checks.

## Options considered

| Option | Benefits | Costs / risk |
| --- | --- | --- |
| Directly update `operator_release_group_selections` | Smallest code change | Bypasses reconciliation snapshots, run coalescing, and policy-save activity. Rejected. |
| Send a full artist draft from Missing Music | Reuses the existing save endpoint | A stale browser projection could unintentionally overwrite unrelated artist edits. Rejected. |
| Link only to Artist Detail | No mutation surface | Leaves the common Missing Music action unnecessarily indirect. Deferred as the advanced editor. |
| Narrow server-side manual-inclusion command | Saves one explicit intent through the existing snapshot workflow and protects server authority | Adds a small service, route, composable, and confirmation context. Selected. |

## Recommendation stack

1. **Narrow action:** only turn the release currently selected by policy into a
   full manual inclusion. It does not choose a different edition, edit track
   overrides, or start discovery.
2. **Server-derived draft:** load the current user-scoped operator projection;
   confirm that the release group belongs to the artist and that the supplied
   release remains the policy-resolved release; then construct the complete
   draft on the server.
3. **Canonical persistence:** call `saveOperatorArtist` with
   `triggerSource: 'manual_inclusion'`. This preserves existing selections and
   track overrides, creates the reconciliation snapshot, queues/coalesces the
   reconciliation run, and records standard policy-save activity.
4. **Defence in depth:** require a fresh authenticated session and CSRF token;
   use the session user as both owner and actor; reject stale, cross-group,
   unmonitored, or conflicting manual inputs; make an identical repeat a safe
   no-op.
5. **Clear UX:** present **Keep selected manually** only for policy-selected
   releases, show **Manual inclusion** (or **Manual partial selection**) once
   saved, and use a short confirmation that explicitly says reconciliation is
   queued and no search starts.

## Command contract

`POST /api/v1/metadata/artists/:artistId/operator/release-groups/:releaseGroupId/manual-inclusion`

Request body:

```json
{ "metadataReleaseId": "local-release-id" }
```

Success:

- `202 Accepted` when a new snapshot and reconciliation run are queued.
- `200 OK` when the same full manual inclusion was already saved.

The endpoint never accepts a full policy draft from the browser. A conflicting
manual selection returns `409 manual_inclusion_unavailable`; invalid/missing
identifiers return a validation error. The selected group and release are
verified against the current user-scoped projection before the canonical save
workflow runs.

## Deliberate boundary

This action is not a downloader command. It saves durable desired state and
queues reconciliation. Search, candidate review, download handoff, and import
remain distinct later stages of the Music Queue lifecycle.

The next direct-selection increment should be an edition picker or advanced
manual selection launched from Artist Detail. It needs its own design because
choosing a different edition changes the current resolved release and requires
more than the one-decision confirmation used here.
