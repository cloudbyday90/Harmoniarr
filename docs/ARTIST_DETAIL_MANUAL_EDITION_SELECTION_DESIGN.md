# Artist Detail manual edition selection design

**Status:** implemented 2026-08-25

## Problem

Artist Detail already lets an operator preview releases within a release group
and, for an administrator, change the global canonical metadata edition. Those
are different decisions from choosing the edition Harmoniarr should use for
that operator's desired state. The latter needs an explicit, durable manual
selection without making an unreviewed browser draft authoritative.

## Research basis

Research was completed against the official sources below on 2026-08-25.

- [W3C WAI Forms Tutorial — Grouping Controls](https://www.w3.org/WAI/tutorials/forms/grouping/)
  recommends grouping related radio controls with a `fieldset` and `legend`.
  The edition preview therefore uses native radio inputs with a visible group
  label rather than a custom pressed-button set.
- [W3C ARIA APG — Radio Group Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)
  defines the expected single-selection keyboard behavior. Native radio inputs
  preserve browser and assistive-technology behavior without recreating it.
- [W3C ARIA APG — Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
  requires focus to stay in the dialog, Escape to close it, and a visible close
  control. The existing native dialog implementation is retained and the new
  controls remain descendants of it.
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
  requires CSRF protection on state-changing, cookie-authenticated requests.
  The mutation uses the existing fresh-session and CSRF checks.

## Options considered

| Option | Benefits | Costs / risk |
| --- | --- | --- |
| Change the global canonical edition | Existing endpoint and simple UI | Alters shared metadata rather than this operator's desired state. Rejected. |
| Put an alternative release ID in the existing browser policy draft | Preserves the Artist Policy save bar | A stale full draft can overwrite unrelated policy work. Rejected for this direct selection. |
| Write a release-group selection directly | Small implementation | Bypasses snapshots, reconciliation, and Activity evidence. Rejected. |
| Protected manual-edition command with an expected snapshot revision | Durable, narrowly scoped, user-scoped, and safe against stale state | Requires a small server command, a route, and explicit UI states. Selected. |

## Recommendation stack

1. **Separate preview from selection.** A radio group previews one edition at a
   time; it does not persist anything. The visible facts list country, release
   date, track count, medium count, status, and canonical status.
2. **Use a precise action.** **Save this edition** creates a full manual
   selection for the active operator and immediately queues reconciliation. It
   explicitly does not start a search or alter the global default edition.
3. **Keep server authority.** The browser supplies only the artist, release
   group, release, and the snapshot revision it rendered. The server loads the
   current user-scoped projection, verifies ownership and release membership,
   then derives the complete policy draft itself.
4. **Require optimistic concurrency.** The command compares the supplied
   snapshot revision with the current projection and passes that revision into
   the canonical save service. The save service locks the current monitoring
   row and verifies the latest snapshot revision inside its transaction.
5. **Protect track intent.** A release group with partial selection or saved
   track overrides cannot change editions through this action. Its track
   mapping must be reviewed in Artist Policy first.
6. **Avoid competing saves.** The direct action is unavailable while the
   Artist Policy draft has unsaved changes. The operator must save or cancel
   that draft before issuing this separate command.

## Route contract

`POST /api/v1/metadata/artists/:artistId/operator/release-groups/:releaseGroupId/manual-edition-selection`

Request body:

```json
{
  "metadataReleaseId": "local-release-id",
  "expectedSnapshotRevision": 12
}
```

Success returns `202 Accepted` with the updated projection when reconciliation
is queued. Repeating the same manual selected edition returns `200 OK` without
creating another snapshot or run. A changed policy or snapshot returns a
conflict response; the UI leaves the choice uncommitted and asks the operator
to refresh. The route requires a fresh session and CSRF token.

## Deliberate boundary

This is an operator-specific desired-state choice, not metadata curation and
not a downloader command. Global canonical edition remains an administrator
metadata action. Search, candidate review, download, and import remain later
Music Queue stages.
