# Music Queue Release-Scoped Library-Add Diagnostics Browser Acceptance Design

Status: **Implemented.**

Date: 2026-07-31.

## 1. Purpose

The release-scoped library-add diagnostics endpoint accepts a wanted-release ID
from a reloadable URL. That ID must remain navigation state, never an access
grant. This acceptance slice proves the complete application behavior through
two independent signed-in administrator sessions and a fresh PostgreSQL
database.

## 2. Official Sources Reviewed

The following official guidance was reviewed on 2026-07-31 for the requested
June 2026 baseline.

| Source | Design input |
| --- | --- |
| [OWASP API Security: Broken Object Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/) | Every endpoint that reads by client-provided ID must authorize the requested object. Tests must try a copied sibling ID. |
| [OWASP API Security: Broken Function Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/) | The diagnostic route remains restricted to the administrator role as well as to an authorized wanted-release identity. |
| [Playwright: Isolation](https://playwright.dev/docs/next/browser-contexts) | Separate browser contexts model independent sessions, cookies, and local storage without cross-session state leakage. |
| [Playwright: Authentication](https://playwright.dev/docs/auth) | Authentication state must remain isolated for server-side-state tests; multiple accounts are required when scenarios mutate or read account-owned data. |
| [Vue Router: Programmatic Navigation](https://router.vuejs.org/guide/essentials/navigation) | The explicit query parameter remains the durable, reloadable navigation contract. |

## 3. Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Unit-test the service with a mocked repository | Fast and precise for service branching. | Cannot prove the actual query, session, route, client reload, and UI failure behavior work together. | Keep as a lower-level regression layer. |
| Intercept the diagnostic endpoint in a browser test | Simple UI control. | Cannot validate PostgreSQL ownership predicates or the production route. | Reject for this acceptance requirement. |
| Run one authenticated browser session against a real isolated database | Proves direct reload. | Does not test copied cross-account URLs. | Insufficient. |
| Run two independent administrator contexts against a real isolated database | Proves reload, role guard, object ownership, generic 404, redaction, and no client fallback. | Slower than a fixture-only browser test. | Adopt. |

## 4. Final Recommendation Stack

- Use `createBrowserSmokeRuntime` so every scenario receives an isolated,
  migrated PostgreSQL database and the production Express route boundary.
- Create a second administrator account through the normal authenticated user
  API, then log it in within a separate non-persistent Playwright context.
- Seed one metadata release, two operator-owned wanted-release rows, and one
  durable shared quality-stop apply outcome. Private source, policy, and
  status-marker values are intentionally present only in persisted evidence.
- Directly open and reload each owner’s
  `/app/activity/diagnostics/library-adds?wantedReleaseId=<uuid>` URL. Verify
  the safe outcome appears after both reads.
- Copy the other owner’s URL into each session. Require the real endpoint to
  return the same generic 404 contract and verify that the UI does not render
  the global import-pending worklist, a candidate table, or private evidence.

## 5. Security Properties

- The acceptance scenario uses two administrator accounts because the route is
  intentionally administrator-only; the second account still has no access to
  the first account’s wanted-release identity.
- A shared candidate can retain both release IDs for automation correlation,
  but the initial release lookup is owner scoped before durable outcomes are
  selected.
- The test places private policy markers, source paths, usernames, and raw
  status text in database evidence, then asserts they never appear in either
  owner or copied-URL page.
- The failure assertion checks a 404 at the network boundary and confirms the
  scoped UI does not silently replace the failed read with the global library
  add queue.

## 6. Outcome

The release-scoped diagnostics handoff is now proven to survive browser reload
for its owner and reject a copied sibling URL without exposing data or changing
the user into an unrelated global troubleshooting flow. The acceptance test
also exposed a production compatibility defect: the service accepted UUIDv1
through UUIDv5 even though Harmoniarr's PostgreSQL schema prefers UUIDv7. The
identifier guard now accepts modern RFC UUID versions while the parameterized
PostgreSQL UUID cast and owner-scoped query remain the authoritative input and
authorization checks. No API shape, schema, or migration change was required.

## 7. Validation

- Browser acceptance test runs the real Express app, authentication flow,
  PostgreSQL schema, authorization route, and Vue view in two isolated browser
  contexts.
- Focused server and client contracts continue to cover response projection,
  generic 404 semantics, UUIDv4 and UUIDv7 identifiers, query routing, and
  direct Music Queue handoff.
