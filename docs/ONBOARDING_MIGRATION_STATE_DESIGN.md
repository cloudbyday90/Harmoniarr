# Onboarding migration state and refresh design

October 26, 2026. Follows the next item from
[migration observation](MIGRATION_OBSERVATION_OUTCOME.md).
See separate [research/tradeoffs](ONBOARDING_MIGRATION_STATE_RESEARCH.md) and
[outcome](ONBOARDING_MIGRATION_STATE_OUTCOME.md).

Extract the database checklist projection into onboarding-migration-step.js.
Consume the settled migration observation rather than inventing a pending entry
on rejection. A valid applied count and pending list yield complete or attention;
rejection and malformed data yield unavailable with fixed guidance. Do not expose
the rejection reason, SQL, filenames, paths or error code. Keep the existing
read-only reader and HTTP authorization/no-store behavior.

Unavailable is an explicit step status and remains an open issue in aggregate
accounting. It cannot contribute to the ready-step count or produce an all-ready
summary. Preserve actual pending counts and distinguish their Needs attention
label from Unavailable. Change the database heading to Check database migrations;
this panel reports a check rather than offering a migration command.

The existing fetch composable owns one active read. Rapid Refresh, polling and
visibility-triggered callers share its completion. Clear an existing poll timer
before admission and schedule the next poll after completion. Retain successful
data while revalidating and after a failed refresh; first-load failure has no
checklist. Use fixed failure copy rather than transport text. On disposal, stop
polling/listeners, close new admission and suppress late state changes. This does
not abort the admitted HTTP/database work or prove server-side cancellation.

The view registers disposal on unmount and passes revalidation state to the
panel. Keep the native Refresh button mounted, named Refresh and focusable. While
busy, aria-disabled conveys state and the click guard prevents duplicate intent;
the composable independently coalesces calls. Hide setup mode remains available.
Never restore focus on completion after the user has moved it elsewhere.

Mount one polite atomic status paragraph outside the results' aria-busy wrapper.
Use a setup-time Vue useId for the results identifier and connect it with
aria-controls. Keep the last successful checklist rendered after refresh failure
and explain that it is retained history, not a fresh result. Show a fixed inline
error explanation without a second live region. The existing design tokens and
grid spacing own the small style additions.

Validation combines pure projection/accounting checks, real deferred-fetch and
disposal controls, and browser keyboard/focus/status identity tests. The browser
uses controlled current/pending/unavailable/error replies in the real authenticated
shell; it proves presentation behavior, not actual database failure. The guarded
packaged migration-observation entry separately removes the real migration table,
verifies unavailable status/issue accounting and preserves the existing DDL,
authorization, backup export and restore-apply controls. Keep these evidence types
distinct. Manual screen-reader and physical-device checks remain deferred.

No schema migration, dependency, additional deployment service, new pool, release
or branch is needed. Startup preparation and fatal schema validation are outside
this presentation change and retain their existing contracts.
