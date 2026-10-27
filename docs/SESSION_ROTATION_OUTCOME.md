# Session rotation outcome

October 27, 2026. Implemented on main without a new branch, release or tag.

## Delivered

Rotation, root issuance and replay now share bounded write ownership. Replay's
existing error code remains stable through a thin adapter; issuance failures use
fixed 503 `session_write_unavailable`. The generic owner retains the qualified
8s deadline, transaction-local timeouts, actual native retirement and conservative
COMMIT uncertainty. It never retries a write or returns credentials before ack.

Rotation uses account share lock, fresh account snapshot, transaction-scoped
family lock and exact parent row/hash lock. Child insertion, active-parent CAS,
replacement link and required `session_rotated` audit commit together. Final
database-clock expiry is rechecked after audit. The password epoch comparison
preserves microseconds as database text. A second redemption applies replay on
that same transaction, commits revocation/audit and then returns 401. No nested
checkout or per-family application registry was added.

Root issuance creates a fresh family and refuses supplied parent/family grafts.
Selected metadata normalization is shared, including invalid/zone-scoped IP
refusal to null. Refresh uses the existing deployment-controlled CSRF guard and
returns current transaction-owned user facts. Its response/cookie shape and
endpoint remain stable; clients using refresh must supply the matching CSRF
header when protection is enabled. Explicit configured opt-out remains supported.

## Executed validation

Focused service/replay/route command passed 34 tests. The final fast gate ran all
`validate:fast` stages with server concurrency 8: **6,243 server, 4,503 client and
703 script tests, 11,449 total**, with no failures, skips or cancellations.
Lint, ESM, copyright, migrations, snapshot/anchor contracts, Compose policies,
hygiene and production build passed. `npm run validate:security:npm` reported
zero advisories.

`node --test --test-concurrency=1 test/integration/runtime-http-contract.test.js`
passed all four actual PostgreSQL HTTP cases, including refresh/logout CSRF
refusal, successful refresh, stale/cross-session CSRF, current role and revoked
session controls. No skip was taken.

Four separate immutable packaged PostgreSQL entries passed:

- `session-rotation.test.js`: fifteen scenarios covering real HTTP CSRF/cookies,
  atomic parent/child/link/audit, competing parent redemptions, rotation-first and
  replay-first family races, required-audit rollback, account/family/parent lock
  timeout rollback/retry, current authority and precise password epoch, account
  snapshot after waiting, expiry during audit, uncertain commit, deadline backend
  retirement and root graft refusal.
- `session-replay.test.js`: thirteen existing replay/metadata/atomicity/native
  lifetime scenarios after shared locking/owner extraction.
- `session-pool-admission.test.js`: ten existing admission, current authority,
  cancellation, backend retirement and explicit retry scenarios.
- `schema-diagnostics-http.test.js`: actual reader, fresh authority, no-store,
  bounded scan admission and unchanged ledger/catalog controls.

Each ran network-none, root read-only, UID 1000, 2 CPUs, 3 GiB memory/swap, PIDs 256,
private tmpfs data and no published port. Each exited 0, was removed, and exact
container absence was verified. Commit-loss qualification suppresses acknowledgement
after a real COMMIT through a fixture wrapper; it is not a network-loss claim.

The live existing-admin Chromium smoke confirmed the saved CSRF opt-out remained
in effect and passed valid-header cookie rotation, current user response,
explicit no-store schema refresh, all 164
anchors current, preserved focus and mobile layout. Desktop/mobile screenshots
were inspected. This does not establish screen-reader or full WCAG acceptance;
previously deferred manual checks remain deferred. Linux data-bind publication/
directory-sync/readiness/collision/cleanup probe passed.

The walkthrough's existing stored CSRF mode is `disabled`; it was not silently
changed. The first browser assertion incorrectly assumed required mode and
stopped on the expected permitted refresh. The corrected smoke reads and asserts
the effective saved policy. Required-mode refusal is established by the fresh
packaged/native and HTTP integration cases, not by that live walkthrough. Required
CSRF remains the recommended deployment policy.

## Evidence and limits

Frozen source: 3,714 files, SHA-256
`6ef4f11799dff2dd5ba6feb633a2143b06d10c2d6afa0593e28ca8283519b238`.
All seventeen changed code/test files were captured before packaged qualification.
Only documentation followed. Eleven changed production paths exactly match the
image; all other server/shared/client bytes and package inventories match the
previous candidate. Evidence is private under `.tmp/session-rotation-2026-10-27/`;
the final fast gate is `fast-final/`.

An initial source-overlay preflight used server output built before the timestamp
text refinement and failed the precise password-epoch refusal. Rebuilding that
output passed; the final run used immutable packaged code matching the freeze.
The refusal assertion and production bounds were retained. Existing file line
endings were preserved before the final source capture and fast gate.

GitHub MCP found **no open PRs**, including Dependabot. No PR could be selected,
implemented, rebased or closed in this step; no PR was merged.

The family protocol requires participating issuers: stop old binaries before
adoption. Other logout, single-session and account-wide revocation writers remain
separate owners; this is not whole-account revocation certification. Strict
concurrent refresh may revoke the winning child and require signing in again.
Prior provider/media/migration matrices were not rerun; their historical results
retain their original scope. The earlier Windows backup directory-fsync EPERM
finding was not repaired or requalified here.

## Recommendation and next item

Retain bounded admission, account/family/parent lock order, current parent CAS,
atomic child/link/audit, required CSRF and acknowledged commit/retirement. The
benefit is a fenced descendant-issuance protocol with atomic evidence; costs are
additional round trips, brief contention and strict duplicate-refresh refusal.
See [research](SESSION_ROTATION_RESEARCH_2026_10.md) for alternatives.

**Next: bind root login to its verified credential epoch and atomically publish
the required login audit with issuance.** The fresh enabled-account check cannot
validate a password verified before a concurrent password change; login audit
currently remains a separate statement after issuance.

See [design](SESSION_ROTATION_DESIGN.md),
[Docker design](LOCAL_DOCKER_SESSION_ROTATION_DESIGN.md) and
[Docker outcome](LOCAL_DOCKER_SESSION_ROTATION_OUTCOME.md).

October 27 follow-up: password login's verified credential state, bookkeeping,
root issuance and required audit now share a bounded transaction. See the
[login design](PASSWORD_LOGIN_DESIGN.md) and [outcome](PASSWORD_LOGIN_OUTCOME.md).
The next-item wording above records the original rotation candidate's remaining
scope; failed-login and non-password issuance have separate followups.
