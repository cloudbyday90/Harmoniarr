# Dedicated Downloader Route Deprecation Design

Date: 2026-06-06

## Scope

Remove the temporary `/app/activity/downloads` compatibility route now that the
Downloader page exists as a first-class top-level operator surface.

This phase is intentionally limited to route ownership:

- keep `/app/downloader` as the only registered Downloader route
- remove the `activity-downloads` route name and redirect
- leave the existing Activity workspace redirects for unrelated historical
  routes untouched
- avoid backend changes because the Downloader page still uses the existing
  admin-only downloads read contract

## Official Research Baseline

Research was performed against official primary sources available through
May 31, 2026. URLs were discovered and verified online rather than inferred.

- Vue Router's redirect and alias guidance documents redirects as explicit
  route records and notes that navigation guards run on the resolved target,
  not on the redirecting route:
  https://router.vuejs.org/guide/essentials/redirect-and-alias.html
- Vue Router's route matching guidance describes static route paths as the
  normal path for most applications and reserves broader matching syntax for
  cases that need it:
  https://router.vuejs.org/guide/essentials/route-matching-syntax.html
- Vue Router route meta fields provide the official mechanism for attaching
  route authorization metadata that global guards can evaluate:
  https://router.vuejs.org/guide/advanced/meta
- OWASP Authorization Cheat Sheet recommends least privilege, deny by default,
  and validating permissions for every request:
  https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html

## Current Problem

The initial dedicated Downloader page shipped with a compatibility redirect from
`/app/activity/downloads` to `/app/downloader`. That was useful while promoting
the page, but keeping it after the top-level page is established has drawbacks:

- it preserves Activity as a second apparent owner for downloader behavior
- it leaves an extra named route in the requester restriction list
- it encourages future code to target a deprecated URL instead of the canonical
  route
- it makes the route graph harder to audit because access behavior is split
  across a redirecting route and the actual target route

## Options

### Option A: Keep The Redirect

Pros:

- old bookmarked links continue to resolve
- no code change required
- query and hash preservation already works

Cons:

- Activity continues to appear responsible for live transfer visibility
- route guards only evaluate the target route after the redirect resolves
- deprecated route names can continue leaking into navigation, tests, or docs
- the compatibility code has no clear removal point

### Option B: Replace Redirect With Alias

Pros:

- the old URL can render the Downloader component without redirecting
- avoids one navigation hop

Cons:

- worse product clarity because `/app/activity/downloads` still appears valid
- canonical-route ambiguity remains
- any future share/copy-link behavior could keep emitting the deprecated URL
- aliasing is unnecessary when the platform has no public SEO requirement for
  this private authenticated route

### Option C: Remove The Legacy Route Entirely

Pros:

- one route owns the Downloader surface: `/app/downloader`
- removes the deprecated named route and redirect code
- keeps navigation and authorization review simpler
- aligns future downloader work around a first-class platform area

Cons:

- old manual bookmarks to `/app/activity/downloads` no longer resolve
- operators must use the sidebar or the canonical URL

### Option D: Add A Server-Level Deprecation Response

Pros:

- old links could receive an explicit HTTP status such as `410 Gone`
- deprecation is visible before the SPA loads

Cons:

- adds backend surface for a client-only authenticated route
- does not improve the in-app operator experience
- unnecessary for a private route that was only briefly present

## Final Recommendation Stack

Use Option C.

Recommended stack:

- Canonical route: `/app/downloader`.
- Navigation: top-level operator sidebar item only.
- Legacy route: remove `/app/activity/downloads` and the `activity-downloads`
  route name.
- Authorization: keep `downloader` in the requester route restriction list; do
  not maintain a second restricted legacy name.
- Redirect posture: no redirect, no alias, and no server-level compatibility
  response for this internal route.
- Documentation posture: mark Activity downloads as deprecated and unregistered
  rather than redirected.

## Implemented Outcome

- Removed the `activity-downloads` child route from the Activity workspace.
- Removed `activity-downloads` from the requester restricted route-name set.
- Kept the canonical `/app/downloader` route and operator navigation entry.
- Updated the downloader and request-journey design documents to remove stale
  redirect language.

## Security

- Requesters remain blocked from the Downloader page through the `downloader`
  route-name restriction.
- No new endpoint, redirect target, alias, mutation, or data field was added.
- The route graph is smaller, which makes least-privilege review more direct.
- Backend authorization remains unchanged: the page still uses the existing
  admin-only downloads API.

## Validation

Validation for this route cleanup:

- `node --test test/client/app-shell-presentation.test.js`
- `npm run lint:client`
- `npm run build:client`
- `npm test`
- `npm run build`

## Next High-Value Design Areas

1. **Downloader action eligibility and operator controls.** Build on
   `DOWNLOADER_QUEUE_READ_MODEL_DESIGN.md` by designing cancel, retry, clear,
   and pause/resume controls with fresh-session, CSRF, idempotency, rate limits,
   and audit events.
2. **Requester-scoped transfer actions.** Design cancel, retry, and requeue
   behavior with per-request authorization, CSRF, idempotency, rate limits, and
   audit events before exposing transfer mutations.
3. **Downloader event history and audit trail.** Persist meaningful downloader
   events so the detail drawer can explain how a transfer reached its current
   state, not only what the live provider reports now.
