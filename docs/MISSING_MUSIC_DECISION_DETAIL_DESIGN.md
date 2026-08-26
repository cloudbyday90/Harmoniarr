# Missing Music decision-detail design

**Status:** implemented — secure, read-only detail boundary and routed inspector

**Started:** 2026-08-26

## Outcome

Missing Music now has a canonical, deep-linkable detail read for one requested
release:

```
GET /api/v1/missing-music/decisions/:decisionId
```

The endpoint resolves the signed-in actor first, derives the permitted
household scope on the server, and only then looks up the requested release.
An administrator can open an active or disabled household member's history.
An operator or requester is limited to their own release. An unavailable or
out-of-scope identifier returns the same not-found response, rather than
revealing whether another person's release exists.

The read response contains only the release-decision projection already
appropriate for Missing Music:

- release name, artist, type/date, coverage, and last reconciliation time;
- target username and whether the account is disabled;
- plain-language status and next step; and
- a read-only flag for disabled-account history.

It does not include source-provider identities, paths, transfer data, raw
candidate evidence, or a browser-supplied target-account assertion.

The Missing Music worklist now opens this projection through a named
**Open status details** link. The inspector keeps the worklist visible,
identifies the affected account, shows coverage and the current plain-language
status, and provides a named **Back to release decisions** destination.

## Design decision

Use a **routable inspector**, not a modal:

- A release decision can be linked, refreshed, and revisited without relying
  on transient page state.
- Ordinary navigation avoids imposing modal focus-trapping behavior before a
  confirmation is actually required.
- The inspector heading receives focus only when the operator opens the
  release, and the visible return link makes its destination clear.

The details view is intentionally read-only for this slice. The previous Music
Queue “use match” route binds both actor and target to the signed-in user and
immediately changes import-candidate state. Reusing it for household-wide
Missing Music would make cross-user actions incorrect and could start an
unconfirmed downstream workflow.

## Security boundary

| Concern | Decision |
| --- | --- |
| Authorization | Derive scope from authenticated session and role for every detail request; deny an inaccessible release as not found. |
| Lookup efficiency | Pass the scoped account IDs and release ID to the library store, bounded to one result. |
| Data minimization | Project only release-decision facts; raw provider, candidate, path, and transfer fields remain outside this API. |
| Disabled accounts | Keep history readable to administrators, mark it read-only, and expose no mutation from the detail. |
| Abuse resistance | Apply a separate read rate-limit bucket to the detail route. |
| State changes | No state change exists in this slice, so neither CSRF nor idempotency is accepted here. The later command endpoint must require both. |

## Alternatives considered

| Option | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Reuse the Music Queue inspector and mutation API | Lowest UI effort | Ties household work to session-only authorization and immediate selection | Rejected |
| Send all detail evidence to the browser and decide scope client-side | Fast prototype | Leaks provider/transfer fields and bypasses server authorization policy | Rejected |
| Server-authorized, minimal detail read before commands | Stable route and multi-user boundary; keeps evidence private | Candidate selection follows in a later slice | Adopted |

## W3C and implementation guidance

The detail is a normal route with a heading and an ordinary return link. It
does not use an ARIA tab or dialog pattern simply to switch a view. Its heading
has a programmatic name and receives focus after the user activates the
worklist link, making the context change understandable to keyboard and screen
reader users. Status text shown as ordinary page content is not a global live
region; routine polling must not repeatedly announce the entire detail.

When the later **Start download** confirmation is added, it will use a native
`<dialog>` only if it behaves as a true modal: focus moves inside, keyboard
focus remains contained, Escape cancels, and focus returns to the invoking
control. The least destructive action will remain the initial focus target.

Sources checked 2026-08-26:

- [W3C ARIA APG — Modal Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [W3C WCAG 2.2 — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- [W3C WCAG 2.2 — Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Vue — Composables](https://vuejs.org/guide/reusability/composables)

## Next command slice

Implement a dedicated Missing Music command service that keeps **actor** and
**target account** distinct. It must:

1. re-resolve the decision and target scope at mutation time;
2. reject disabled target accounts;
3. record actor, target, release, chosen candidate, and result in audit
   history;
4. require a fresh session, CSRF token, and idempotency key; and
5. separate **Use this match** from a visible **Start download** confirmation.

Only that service may call the underlying candidate-selection and transfer
workers. The client must never route a cross-user decision through the older
session-scoped Music Queue mutation.

## Open pull-request assessment

No open pull request was suitable to apply locally for this slice:

| Pull request | Assessment |
| --- | --- |
| #23 docker metadata-action update | Superseded by the newer version already on main. |
| #24 docker build-push-action update | Superseded by the newer version already on main. |
| #40 Node 24.19-alpine to 26.7-alpine | Incompatible with the supported Node 24 LTS baseline. |

The authenticated GitHub CLI could not list pull requests because its stored
credentials returned HTTP 401. The public repository pull-request API was
used for this read-only assessment. No PR was merged or otherwise changed.
