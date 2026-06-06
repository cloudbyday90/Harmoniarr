# Dedicated Downloader Page Design

Date: 2026-06-06

## Scope

Create a first-class Downloader page for operators instead of keeping live
transfer visibility inside Activity.

This phase is intentionally limited to the operational read surface:

- add a top-level `/app/downloader` route and sidebar entry
- make `/app/downloader` the canonical Downloader route
- consume a Harmoniarr-owned Downloader read model
- improve the frontend transfer presentation with summary counts, filters, and
  accessible progress indicators

This phase does not add transfer actions, queue mutation controls, or a
database-backed downloader history store.

## Official Research Baseline

- W3C WCAG 2.2 recommends using the current WCAG version for accessibility
  work and defines Status Messages 4.1.3 so status updates can be presented by
  assistive technologies without moving focus:
  https://www.w3.org/TR/WCAG22/
- W3C Understanding Status Messages says progress/status updates should be
  programmatically determinable, but nonessential polling updates should avoid
  becoming noisy live-region announcements:
  https://www.w3.org/WAI/WCAG22/Understanding/status-messages
- WAI-ARIA APG navigation landmark guidance says navigation link groups should
  use `nav`, and multiple navigation landmarks should have unique labels:
  https://www.w3.org/WAI/content-assets/wai-aria-practices/patterns/landmarks/examples/navigation.html
- WAI-ARIA APG describes accessible semantics for web patterns and widgets:
  https://www.w3.org/WAI/ARIA/apg/
- Vue Router official guidance recommends dynamic imports for routes so route
  components are code-split and loaded on demand:
  https://router.vuejs.org/guide/advanced/lazy-loading.html
- Vue Router official nested-route guidance supports keeping old URL structures
  stable through route configuration and redirects:
  https://router.vuejs.org/guide/essentials/nested-routes.html
- Vue Router's redirect and alias guidance documents redirects as explicit
  route records and notes that navigation guards run on the resolved target,
  not on the redirecting route:
  https://router.vuejs.org/guide/essentials/redirect-and-alias.html
- Vue Router's route matching guidance describes static route paths as the
  normal path for most applications:
  https://router.vuejs.org/guide/essentials/route-matching-syntax.html
- Vue Router route meta fields provide the official mechanism for attaching
  route authorization metadata that global guards can evaluate:
  https://router.vuejs.org/guide/advanced/meta
- OWASP Authorization Cheat Sheet recommends least privilege, deny-by-default,
  and validating permissions on every request:
  https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP Web Security Testing Guide warns that APIs should not return more data
  than clients need and should not rely on client-side filtering to protect
  sensitive fields:
  https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/12-API_Testing/03-Testing_for_Excessive_Data_Exposure
- slskd's official project describes downloads as an operational surface for
  speed, status, user/folder grouping, queue position, retry, cancel, and clear
  controls:
  https://github.com/slskd/slskd
- slskd official configuration documents download slots, speed limits, retry
  behavior, partial resume behavior, and transfer retention:
  https://github.com/slskd/slskd/blob/master/docs/config.md

## Current Problem

Activity is an event and operational history workspace. Downloads are different:
they are a live operational queue with active progress, stalled work, queue
position, source grouping, and future actions.

Keeping Downloads inside Activity creates three product and architecture
problems:

- the primary operational control surface is hidden behind an audit/history
  workspace
- future transfer actions would be mixed with Activity's broader event model
- operators cannot quickly distinguish active, queued, completed, and failed
  transfer states without scanning a single table

## Options

### Option A: Keep Downloads Inside Activity

Pros:

- smallest code change
- no navigation changes
- keeps current route and page behavior intact

Cons:

- Activity remains overloaded
- future retry/cancel/requeue controls would be added to the wrong workspace
- the page cannot grow into a downloader console without making Activity noisy

### Option B: Add Dedicated Page With Existing API

Pros:

- establishes Downloader as a first-class platform component immediately
- keeps backend risk low by reusing the current admin-only slskd downloads read
  contract
- lets UI and product language mature before adding queue mutations

Cons:

- still depends on the upstream grouped slskd response shape
- no durable historical downloader read model yet
- required a follow-up route deprecation pass to remove the temporary Activity
  downloads compatibility redirect

### Option C: Build New Backend Downloader Read Model First

Pros:

- best long-term backend boundary
- could combine live slskd state, import candidates, retries, operation runs,
  and stale-progress policy in one contract
- could minimize fields further before any UI consumes them

Cons:

- larger scope and higher schema/service risk
- delays the obvious navigation and product ownership correction
- premature before the first operational page proves which summary fields and
  filters matter

## Final Recommendation Stack

Use Option B for this phase.

Recommended stack:

- Route: `/app/downloader`, lazy-loaded through Vue Router dynamic imports.
- Navigation: top-level operator nav item labeled `Downloader`.
- Legacy URL: no Activity downloads compatibility route; `/app/activity/downloads`
  is deprecated and no longer registered.
- Authorization: use the admin-only `GET /api/v1/downloader/queue` read model,
  backed by the existing slskd service.
- Presentation: consume normalized transfer rows, queue health, source groups,
  and disabled future action eligibility from the read model.
- Accessibility: use semantic page headings, existing labeled nav landmarks,
  button `aria-pressed` for filters, and native `<progress>` elements for
  determinate and indeterminate active transfer progress.
- Security: do not expose Downloader to requester navigation or requester route
  access. Do not add mutation controls until action eligibility, CSRF,
  idempotency, and audit behavior are designed.

## Implemented Outcome

- Added `src/client/views/DownloaderView.vue`.
- Added the top-level `downloader` route at `/app/downloader`.
- Added a top-level operator nav item for Downloader.
- Added a distinct download icon in desktop and mobile navigation.
- Removed the temporary `/app/activity/downloads` redirect in the follow-up
  route deprecation pass documented in
  `DEDICATED_DOWNLOADER_ROUTE_DEPRECATION_DESIGN.md`.
- Removed the Activity Downloads tab and deleted the old Activity-specific
  downloads view.
- Extended `activity-downloads-presentation.js` with tested flattening and
  transfer-count helpers.
- Added filters for all, active, queued, completed, and failed transfers.
- Added summary cards for active, queued, complete, and failed transfer counts.
- Added native transfer progress elements for accessible progress display.
- Added the follow-up `GET /api/v1/downloader/queue` read model documented in
  `DOWNLOADER_QUEUE_READ_MODEL_DESIGN.md`, and moved the page off the raw
  `/api/v1/slskd/downloads` provider response.
- Added the follow-up detail drawer documented in
  `DOWNLOADER_DETAIL_DRAWER_DIAGNOSTICS_DESIGN.md`, giving operators a focused
  diagnostics panel for one selected transfer without expanding the queue table.

## Security Outcome

- Requesters cannot access the new route through the existing requester route
  restriction list.
- The page uses an admin-only Downloader read model and does not add new
  requester-visible transfer data.
- No new secrets, API keys, source credentials, raw backend errors, or file
  operations are exposed.
- No mutation controls were added; future controls need fresh-session, CSRF,
  idempotency, state eligibility, and audit coverage.

## Validation

- `node --test test/client/activity-downloads-presentation.test.js`
- `node --test test/client/app-shell-presentation.test.js`
- `npm run lint:client`
- `npm run build:client`
- Full validation is recorded in the implementation commit notes.

## Route Deprecation Update

`DEDICATED_DOWNLOADER_ROUTE_DEPRECATION_DESIGN.md` removes the temporary
Activity downloads compatibility route. The canonical Downloader surface is now
only `/app/downloader`; Activity no longer owns or redirects a Downloads child
route.

## Queue Read Model Update

`DOWNLOADER_QUEUE_READ_MODEL_DESIGN.md` completes the first future area from
this page. The Downloader page now reads `GET /api/v1/downloader/queue`, which
normalizes transfer state, progress, aggregate queue health, source groups, and
disabled future action eligibility on the server.

## Detail Drawer Update

`DOWNLOADER_DETAIL_DRAWER_DIAGNOSTICS_DESIGN.md` completes the focused
diagnostics surface for one selected transfer. The queue read model now includes
safe per-transfer diagnostics, and the page renders those diagnostics through a
native dialog side drawer.

## Next High-Value Design Areas

1. **Downloader action eligibility and operator controls.** Design cancel,
   retry, clear, and pause/resume controls with fresh-session, CSRF,
   idempotency, rate limits, and audit events.
2. **Requester-scoped transfer actions.** Design cancel, retry, and requeue
   actions with per-request authorization, idempotency, rate limits, CSRF,
   audit events, and safe requester-facing labels.
3. **Downloader event history and audit trail.** Persist meaningful downloader
   events so the diagnostics drawer can explain how a transfer reached its
   current state instead of only showing the live provider observation.
