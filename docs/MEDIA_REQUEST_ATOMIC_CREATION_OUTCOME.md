# Atomic music request creation outcome

Status: Implemented and validated
Date: 2026-09-10
Design: [Research, alternatives, and recommendation stack](MEDIA_REQUEST_ATOMIC_CREATION_DESIGN.md)

Follow-up: [External request target ownership outcome](EXTERNAL_REQUEST_TARGET_OWNERSHIP_OUTCOME.md)
records the subsequent per-target planning and ownership changes. The evidence
below describes the original atomic-creation implementation.

## Delivered behavior

Music request creation now commits the eligible parent/child family, stored
child count, required audits, and external parent-planning intent together.
Failures in child insertion, audit persistence, or planning leave no partial
family. The invalid child SQL now includes the missing timestamp expression.

`database-transaction-service.js` owns checked-out client lifecycle and preserves
the original operation error if rollback fails. The focused
`library-media-request-creation-service.js` owns transactional persistence and
post-commit publication. The existing request service retains validation,
eligibility, and classification. All new JavaScript uses ES modules.

Optional Activity publication runs once per created request after commit. One
household notification is emitted per submission. Optional callback failures
cannot report a committed request as failed. External planning remains a durable
operation in the existing queue; no provider/network work runs in the transaction.

The same client reaches child read-backs, count/evidence writes, required audits,
planning-run lookup/creation, and maintenance checks. No migration or new queue
was required.

## Security and product feedback

Session, CSRF, permissions, administrator-only multi-target delegation, existing
eligibility policy, unique targets, and the 50-target limit are retained.
Ineligible targets are now reported even when only one eligible target remains.

Browser verification discovered that an unexpected audit constraint error was
being returned verbatim. Request creation now normalizes unexpected errors to
fixed public text, preserves the internal cause, and keeps known policy errors
actionable. SQL/table/constraint details no longer appear in this form.

The existing Request Music form exposes success through a persistent `status`
region and errors through an `alert` region, without moving focus. A failed
submission retains its draft; a successful retry resets the form and announces
saved-request success. These focused checks are not a complete WCAG audit.

## Verification

Passed against the implementation:

- `node --test test/server/database-transaction-service.test.js test/server/library-media-request-creation-service.test.js test/server/library-media-request-service.test.js`: 57 tests, no skips.
- `node --test test/server/library-media-request-creation-error.test.js test/server/library-media-request-service.test.js`: 41 tests, no skips.
- `node --test test/server/library-media-request-store.test.js test/server/notification-callback-wiring.test.js test/server/maintenance-lock-write-guard-service.test.js test/server/library-routes.test.js`: 78 tests, no skips.
- `node --test --test-concurrency=1 test/integration/library-media-request-atomic-creation.test.js`: six tests against disposable PostgreSQL, no skips. Covers family ownership, duplicate targets, child/audit/planning rollback, clean retries, CSRF, delegation denial, disabled targets, and durable parent planning.
- `npm run build:client`: passed.
- `node --test --test-force-exit --test-concurrency=1 test/browser/media-request-creation-feedback.test.js`: one Chromium/PostgreSQL scenario, no skips. Covers retained draft, sanitized error, rollback, successful retry, and programmatic feedback.
- Focused ESLint and `git diff --check`: passed.

Final validation against the combined implementation and updated dependencies:

| Gate | Result |
| --- | --- |
| `npm run validate` | Passed: 3,212 server, 4,164 client, 328 script, and 43 integration tests; 7,747 total, zero failures or skips |
| Repository policy and build checks included above | Copyright, migration policy, schema snapshot (95 migrations), ESM, image tags, Compose topology, lint, test hygiene, and both client/server builds passed |
| Focused Chromium/PostgreSQL regression repeated with final dependencies | One passed; zero failures or skips |
| `npm run validate:security` | Passed; npm audit reports zero vulnerabilities |

Release validation initially found affected sharp and qs dependencies. Their
compatible updates and Windows/Alpine native-package evidence are recorded
separately in the [dependency outcome](DEPENDENCY_SECURITY_UPDATE_2026_09_OUTCOME.md).
No published-image rollout or complete release go/no-go exercise is claimed.

## PR assessment

All three open PRs were inspected through GitHub MCP. PRs 23 and 24 contain action
versions already superseded locally. PR 40 changes only a fixture to Node 26,
outside the selected Node 24 baseline. No applicable PR was applied; none was
merged. Exact links and reasons are in the design document.

## Limits and next item

Atomicity does not provide HTTP POST replay idempotency. A lost response after a
successful commit remains ambiguous; the error copy tells the user to check
existing requests before trying again. Optional notifications remain best effort.

The next recommended item is external URL child fulfillment: establish how child
targets share the parent's planning/acquisition outcome while preserving target
ownership. Existing children have no independently queued planning and fulfillment
does not follow `fanOutParentId`. This is separate from the now-tested creation
transaction and remains unimplemented here. After that, proceed to Music Queue
and provider-catalog pagination from the release review.
