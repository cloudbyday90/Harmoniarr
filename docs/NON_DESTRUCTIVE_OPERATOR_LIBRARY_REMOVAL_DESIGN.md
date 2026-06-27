# Non-Destructive Operator Library Removal Design

Status: Implemented
Last updated: 2026-06-27
Owner: Product + library architecture

## Scope

This slice separates operator library visibility from physical media deletion.

Operators can now remove a reconciled library release from their own Library
view without deleting files, metadata, requests, wanted state, or shared
catalog records. The same view exposes a `Removed from view` filter so the
operator can restore the release later.

## Official Source Review

Reviewed as of June 2026:

- OWASP Authorization Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP Cross-Site Request Forgery Prevention Cheat Sheet:
  https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html
- PostgreSQL, Row Security Policies:
  https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- PostgreSQL, Partial Indexes:
  https://www.postgresql.org/docs/current/indexes-partial.html
- PostgreSQL, Constraints:
  https://www.postgresql.org/docs/current/ddl-constraints.html
- Express, Routing:
  https://expressjs.com/en/guide/routing.html
- Express, Using Middleware:
  https://expressjs.com/en/guide/using-middleware.html
- WAI-ARIA Authoring Practices Guide, Alert Dialog Pattern:
  https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/
- Vue, Form Input Bindings:
  https://vuejs.org/guide/essentials/forms.html
- Playwright, Locators:
  https://playwright.dev/docs/locators
- Playwright, Best Practices:
  https://playwright.dev/docs/best-practices

## Recommendations

1. Persist removal as operator-scoped visibility state.

   Pros: deletion semantics stay explicit, shared library data remains intact,
   and each operator gets an independent view.

   Cons: read paths must join a small user-scoped state table.

2. Default missing rows to `visible`.

   Pros: existing libraries require no backfill, the migration is additive, and
   only intentional removals create rows.

   Cons: restore operations keep a visible row for audit continuity rather than
   returning to a rowless state.

3. Use a role-gated mutation route with CSRF.

   Pros: aligns with existing protected mutation posture, blocks requester
   visibility mutations, and records safe audit evidence.

   Cons: requester sessions can still read the Library view but cannot curate
   its visibility.

4. Expose removed releases through a first-class filter.

   Pros: removal is reversible through the same surface and does not depend on
   hidden admin tooling.

   Cons: the Library grid gains one more filter group.

## Pros vs. Cons Summary

Persisted visibility state is slightly more complex than simply deleting
reconciliation rows, but it preserves operator intent without damaging shared
catalog truth. A soft-delete column on `library_release_reconciliations` was
rejected because reconciliation is a shared projection, not an operator-owned
preference. A destructive file-delete flow was rejected because it conflates
view curation with media storage maintenance.

## Final Recommendation Stack

- Database:
  - `operator_library_release_visibility`
  - unique `(app_user_id, metadata_release_id)`
  - checked `visibility_state IN ('visible', 'removed')`
  - user/state and release lookup indexes
- Server:
  - `library-release-visibility-store.js` for persistence only
  - `library-release-visibility-service.js` for role policy, validation, and
    audit evidence
  - `GET /api/v1/library/releases?visibility=visible|removed|all`
  - `POST /api/v1/library/releases/:metadataReleaseId/visibility`
- Client:
  - Library `Library view` filter with `Visible`, `Removed from view`, and
    `All`
  - card/list actions for `Remove from library view` and `Restore to library
    view`
  - shared alertdialog confirmation for removals
- Tests:
  - store SQL contract
  - service policy/audit contract
  - route session/CSRF contract
  - client API/composable/normalization contract

## Security Notes

The mutation route requires an authenticated session and CSRF validation before
calling the service. The service enforces an operator/admin role through the
existing permission model (`library.scan`) and treats route input as untrusted:
visibility state is allow-listed, reasons are length-limited, and the target
release must already exist in the reconciled library projection.

Reads are scoped by `session.appUserId`. Removed-state rows for one operator do
not affect another operator or requester.

## Outcome

Library removal is now non-destructive by design. Operators can hide noisy or
unwanted reconciled releases from their Library surface, review removed items
through a filter, and restore them without touching media files or shared
metadata.

## Next High-Value Item

Track-override remap review UX is the next logical follow-up. The remaining
Discover recommendation plan risk is surfacing `review_needed` and `orphaned`
track override states when metadata changes make a saved track intent
ambiguous.
