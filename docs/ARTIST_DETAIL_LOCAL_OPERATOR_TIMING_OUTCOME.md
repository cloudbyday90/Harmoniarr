# Artist Detail Local and Operator Timing Outcome

Status: Implemented
Date: 2026-08-29

## Outcome

Artist Detail now has real-browser evidence for the complete critical request
decision:

- the existing unimported path proves provider Discography and Related artists
  across cold, fresh, and stale SWR phases; and
- a locally known artist proves the local-metadata request, authenticated
  operator projection, serial request order, and provider-Discography bypass.

The added evidence records only allowlisted request labels and rounded
browser-relative timings. It makes no production behavior change because the
current design is correct for the measured decision: when the local operator
projection provides release groups, Harmoniarr should use it rather than
spending time on a redundant provider browse.

## Implementation

- `testing/browser/artist-detail-cache-browser-evidence.js` now exposes a
  dedicated, bounded builder for local metadata and operator projection
  timings alongside the existing SWR header evidence.
- `test/browser/artist-detail-cache-server-timing-browser-verification.test.js`
  seeds one temporary artist into the scenario's isolated PostgreSQL database
  and verifies the normal SPA request chain under the authenticated admin
  session.
- `testing/integration/metadata-fixtures.js` returns the generated
  MusicBrainz artist identifier from its reusable seed helper, avoiding a
  second query or an identifier leak in the test diagnostic.
- `test/server/artist-detail-cache-browser-evidence.test.js` covers the
  bounded local/operator timing artifact and its rejection paths.

## Security and multi-user outcome

The operator projection remains scoped to the authenticated user. The test
does not introduce a shared projection, browser persistence, or a diagnostic
API. Its temporary metadata is created only inside the disposable integration
database. Timing diagnostics exclude user identities, artist identifiers,
URLs, response data, credentials, and session material.

## Verification

The following passed on 2026-08-29:

- `node --test test/server/artist-detail-cache-browser-evidence.test.js` —
  five unit tests passed, including allowlist and inverted-timing rejection.
- `npm run validate:artist-detail-cache-browser-evidence` — production client
  build and the serial Chromium/PostgreSQL proof passed. The controlled run
  recorded the expected `cold/foreground/fresh`, `fresh/none/fresh`, and
  `stale/background/stale` provider phases, then observed the local response
  finish before the operator request began and no additional Discography
  provider call for the populated projection.

The browser-relative milliseconds are intentionally diagnostic rather than a
machine-dependent performance budget.

- `npm run validate` — passed the repository's copyright, migration, schema,
  ESM, Compose-policy, lint, test-hygiene, server/client/script/integration,
  and production-build checks.
- `npm run validate:security` — passed image and single-node Compose policy;
  npm audit reported zero vulnerabilities.
- `git diff --check` — passed with no whitespace errors.

## Recommendation retained

Do not re-architect the Artist Detail request sequence based on a loading
impression alone. This evidence now distinguishes the durable provider cache
from the local and operator legs. The next implementation change should be
driven by a repeatable dominant leg, with a focused regression first.
