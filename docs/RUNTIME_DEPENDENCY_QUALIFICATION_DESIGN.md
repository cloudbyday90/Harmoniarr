# Runtime dependency qualification design

Date: 2026-10-19. Follow the [TLS outcome](POSTGRES_TLS_IDENTITY_OUTCOME.md) by
qualifying Express/Vue/router PR 49 against actual request and navigation owners.
Keep all authored code ESM and work on main without releases or PR merges.

The selected stack upgrades Express 5.2.1 to 5.3.0 and Vue 3.5.43 to 3.5.44,
retains Router 5.2.0, and separately evaluates random PR 47's language server
5.3.0 to 6.0.2 with TypeScript 6.0.3. Apply dependency deltas against current
source, preserving pg/music-metadata changes absent from older PR bases.

CSRF refusal uses explicitly saved required protection. Current default mode is
disabled, contrary to the security policy's preferred default. Qualification
must expose that gap; changing deployment defaults needs its own compatibility
and migration design. These tests must not imply default enforcement.

The full PR 49 package proposal is first installed locally. Upstream issue 2851
is a concrete library diagnostic: nested navigation, a previously resolved
ancestor Suspense and an async component as the route's sole root. Reproduce
that exact shape with installed Vue 3.5.44/Router 5.4.0 and compare a wrapping-
element control in fresh Chromium pages. The application uses lazy import route
functions and stable DOM roots without that Suspense trigger. Do not describe
the upstream diagnostic as a reproduced application failure. Defer Router 5.4.0
to avoid introducing its known failure into future supported compositions.

## Owners and evidence

| Boundary | Owner | Required evidence |
| --- | --- | --- |
| HTTP parsing, response and proxy behavior | Existing Express app, http-hardening and deployment-security policy | Existing focused native HTTP/security tests; preserve body limits, headers, trust configuration and error minimization |
| Settings mutation | Existing fresh-admin/CSRF route, settings service and PostgreSQL store | Anonymous rejection; missing/invalid token rejection with unchanged rows; valid mutation persists |
| Current authority and revocation | Existing session resolution and auth routes | Downgraded role cannot reuse an issued session for admin mutation; revoked session cannot mutate with replayed cookie/token |
| Lazy nested navigation | Actual production build, application router and Settings workspace | Keyboard activation, real cold child chunks, child replacement and history without document reload or page errors |
| Requester and legacy redirects | Existing browser acceptance files | Actual role flow and canonical decision redirect, not a synthetic router-only substitute |
| Development language server | Installed CLI with TypeScript 6 | JSON-RPC initialize, real JavaScript hover, shutdown and process close; a version command is insufficient |

Add dedicated integration/browser regression files at these owners. Reuse the
existing app, session, PostgreSQL and Playwright fixtures; do not add alternate
production endpoints, router internals or mocked authorization. Register active
native scenarios through actual completion and keep serial file isolation.

Browser proof should preserve a per-document marker across RouterLink navigation
and history so a full reload cannot falsely pass. Assert the old child content
leaves, current link state changes, real new content appears and captured page
errors stay empty. Wait for observable state, without arbitrary sleeps. These
checks inform relevant WCAG focus/navigation practices, not whole-app conformance.
Programmatic focus plus Enter proves activation, not sequential Tab order.

Finish the source and inspect focused evidence before broad validation. Run
affected native HTTP cases once, validate:fast with both builds, then selected
browser files against those final built bytes. Freeze source including lockfiles
and fingerprint browser assets before/after. Retain all failed candidates and
diagnostics. Do not claim a complete integration/browser gate from selected files.
