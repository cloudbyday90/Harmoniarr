# Missing Music multi-user decision query outcome

**Status:** implemented

**Completed:** 2026-08-26

## Outcome

Harmoniarr now has a dedicated, read-only Missing Music decision query for the
future unified Missing Music worklist. It is the first implementation slice of
the documented multi-user workflow; it does not yet change navigation, the
current interim Music Queue UI, or the separate download-confirmation decision.

An administrator can read all active users' current missing-release work by
default, filter to a user, and deliberately switch to disabled-user history.
An operator or requester can read only their own rows. Ownership is resolved
from the authenticated session on the server, never from a client-supplied user
selection.

## Design and implementation

New ESM modules separate the work by responsibility:

| Module | Responsibility |
| --- | --- |
| `missing-music-decision-scope-policy.js` | Resolves role-aware scope and validates account-status input. |
| `missing-music-decision-state.js` | Maps existing acquisition status codes to clear worklist state categories. |
| `missing-music-decision-service.js` | Applies ownership, user retention, bounded search, filtering, safe response projection, and paging. |
| `missing-music-module.js` | Wires the narrow service without expanding the Library or Acquisition singletons. |
| `missing-music-routes.js` | Adapts the authenticated HTTP request to the service. |

`GET /api/v1/missing-music/decisions` is registered in the route inventory and
has a 120-request-per-minute read limiter. It accepts `scope`,
`requestedForUserId`, `accountStatus`, `state`, `q`, `limit`, and `offset`.

The existing wanted-release store now accepts parameterized `appUserIds` and
artist/release text search. This keeps the cross-user condition in the database
query and avoids browser fan-out. The service then reuses the existing
Music Queue release-status projection so the new view cannot drift from the
current search/download/add state rules.

The response is intentionally a safe projection. It includes the opaque
wanted-release `decisionId`, release identity and coverage, target-user display
data, and allowlisted status data. It excludes raw evidence, candidates,
provider identities, transfer identifiers, folders, and filesystem paths.

## Security decisions

- Non-admin `scope=all` is resolved to `mine`; naming any other user returns
  `403`.
- Administrative `scope=mine` cannot be combined with another user's ID.
- A named user must exist for the administrator, otherwise the route returns a
  controlled `404`.
- Disabled users are retained and selectable by an administrator. This read
  path does not grant any additional mutation authority; later mutations must
  remain read-only for a disabled target and retain distinct actor/target audit
  fields.
- Search is trimmed and capped at 120 characters. Page size is capped at 100.
- The service reports `sourceLimitReached` rather than silently truncating its
  bounded 2,000-release source projection.

## Alternatives considered

| Approach | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Client fetches each user's current queue | Quick to prototype | Leaks user enumeration, creates N+1 requests, and makes authorization fragile | Rejected |
| Add another independent decision-status rule | Could make database filtering simpler | Duplicates the release pipeline's status precedence and will drift | Rejected |
| Reuse the acquisition status projection behind a server-authorized query | One source of truth; no provider payload in response | Bounded source projection needs a later indexed read-model optimization for very large households | Adopted |

## Open pull-request assessment

The open pull requests were reviewed before this change was implemented; none
could be safely applied as a separate local contribution this round.

| Pull request | Assessment | Outcome |
| --- | --- | --- |
| #40 (Node 26 Alpine image) | Conflicts with Harmoniarr's intentional Node 24 LTS policy. | Not applied. |
| #24 (`docker/build-push-action` 7.1 → 7.2) | The current branch already uses 7.3. | Superseded; not applied. |
| #23 (`docker/metadata-action` 6 → 6.1) | The current branch already uses 6.2. | Superseded; not applied. |

This preserves the requested “apply locally, test, then commit” workflow while
avoiding a redundant or policy-incompatible change.

## W3C and research rationale

W3C WAI guidance says every form control needs a purpose-describing label and
related controls should be grouped semantically. The planned UI therefore uses
one visible filter group with **User**, **Account status**, **Work state**, and
**Search releases**, rather than ambiguous controls such as "filters" or
"needs review". The response's clear state categories let those labels explain
what changes in the list.

OWASP's authorization guidance requires authorization checks on every request
and recommends denying unapproved access. The query service applies the
role/ownership decision before it asks the wanted-release store for rows. This
removes the browser as an authorization boundary.

Sources checked 2026-08-26:

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [W3C WAI Forms Tutorial — Labeling Controls](https://www.w3.org/WAI/tutorials/forms/labels/)
- [W3C WAI Forms Tutorial — Grouping Controls](https://www.w3.org/WAI/tutorials/forms/grouping/)

## Validation evidence

- Focused scope-policy, service, route, wanted-release-store, acquisition,
  route-inventory, and application-composition tests passed (40 tests).
- Focused coverage proves that requesters cannot enumerate or read another
  user's decisions, administrators can retain disabled-user history, search is
  bounded, responses do not include injected provider-private fields, and the
  new endpoint is registered with authenticated access.
- `npm test` passed, including 37 Docker-backed integration tests.
- `npm run build`, `npm run check:esm`, `npm run check-copyright`, and
  `git diff --check` passed.

## Next recommended item

Build the Missing Music worklist view against this contract: make Missing Music
the canonical release-decision surface, add the labelled admin filter group,
and keep Downloader as the separate transfer workspace. Do not start the
manual-candidate download mutation until the explicit **Use this match** then
**Start download** confirmation contract is approved.
