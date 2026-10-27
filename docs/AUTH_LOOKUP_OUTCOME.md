# Preliminary authentication read outcome

October 27, 2026. Bootstrap existence and initial password-credential reads now
use bounded read-only ownership. The change stays on main with no release/tag,
schema change, cache or additional application service.

## Delivered behavior

The small ESM auth lookup adapter reuses the reviewed session-read owner with
fixed 503 `auth_lookup_unavailable` output. Bootstrap SQL validates a real boolean
existence fact; missing/malformed output, database failure or cleanup uncertainty
cannot mean setup is available. Credential selection keeps its existing minimal
columns and exact textual epoch. Its store now requires a borrowed client and
has no direct pool fallback. Successful/failure writes retain their own current
credential/account checks and independent transaction owners.

Each read has an eight-second checkout/work/cleanup deadline with READ COMMITTED
READ ONLY, one-second lock, three-second statement/idle and five-second SQL
transaction limits. Successful facts return after acknowledged rollback/release.
Aborted/overdue callers can finish before native drainage; actual connection
retirement remains owned, including late checkouts and failed cleanup.

Bootstrap status and login use the extracted unfinished-response-close helper,
which session authorization also reuses. Normal request/body completion does not
cancel a read. Login forwards cancellation only to its preliminary bootstrap and
credential reads. Password hashing starts after checkout release; verification
and required audit/session writes do not consume the request's read signal.
Disconnect after preliminary reads cannot abandon admitted security writes.

Other existing bootstrap callers receive bounded reads with optional cancellation.
The bootstrap-first validation order, username/email normalization, cookie policy,
lockout responses and required audit semantics remain. Read unavailability does
not become invalid credentials or trigger failure bookkeeping.

## Executed qualification

Final source: 3,730 files, SHA-256
`da08a777a0c1bc6ae18cf258599a3a59f07108452c40492efca5ad28f77c1aa8`.
All fifteen affected code/test files were frozen before final qualification. The
ten production paths match the immutable image; only documentation followed.

Focused command `node --test test/server/auth-lookup.test.js
test/server/session-lookup.test.js test/server/password-login.test.js
test/server/auth-routes.test.js test/server/bootstrap-status-service.test.js
test/server/auth.test.js` passed all 51 tests. The fourteen-stage fast gate passed
6,263 server, 4,504 client and 703 script tests (**11,470 total**) with zero
failures, cancellations or skips. Server concurrency was capped at eight. Lint,
ESM, copyright, migration/snapshot/anchor checks, Compose policy, hygiene and
production build passed. npm audit reported zero vulnerabilities.

The packaged `test/native/auth-lookup.test.js` passed sixteen scenarios:

- Empty/nonempty bootstrap and username/email/missing credential facts with
  microsecond epoch precision; actual read-only mutation refusal.
- Pool exhaustion through both helpers and real bootstrap/login HTTP, with fixed
  unavailable output, no cookies and unchanged security-write state.
- Actual app_users table lock timeouts for bootstrap and credential selection.
- HTTP disconnect during bootstrap status, normal login bootstrap and controlled
  login credential reads, with actual backend disappearance and no security writes.
- Real SQL statement timeout, explicit cancellation and owner deadline with native
  drainage; controlled late delivery of a real checkout retired without work.
- Both successful and failed real password verification outside checkout, paused
  through HTTP disconnect, then their required session/audit or failure/audit
  writes completing independently. These pauses control interleaving rather than
  establish a hashing latency or memory bound.
- Ordinary login/bootstrap retry and clean reusable pool settings.

The existing session admission, failure, password-login, rotation and replay
fixtures passed ten, twenty, sixteen, fifteen and thirteen scenarios respectively:
**90 packaged scenarios total**. All six restricted native entries exited 0,
were removed and had exact absence verified. Their established controlled-COMMIT
acknowledgement tests keep their original scope; physical network-loss behavior
is not newly claimed. Source-overlay preflight is separate from final packaged
qualification. See [Docker outcome](LOCAL_DOCKER_AUTH_LOOKUP_OUTCOME.md).
Private logs/receipts are under `.tmp/auth-lookup-2026-10-27/`.

## Recommendation and limits

Adopt bounded pool admission, owned read-only bootstrap/credential selection,
request-close cancellation and verified cleanup, followed by hashing outside SQL
and independent security-write ownership. Benefit: unavailable or abandoned reads
cannot leak native work or publish authority. Cost: extra transaction round trips
and temporary refusal under contention. See [official research and alternatives](AUTH_LOOKUP_RESEARCH_2026_10.md)
and [design](AUTH_LOOKUP_DESIGN.md).

Each read has an independent budget; there is no aggregate login deadline or new
password-hashing admission limit. Additional bootstrap settings/path work after
an empty-table result, non-password account-claim lookups, timing-based account
enumeration and atomic bootstrap creation are not redesigned. Existing W3C
password-manager/paste behavior remains applicable; no new assistive-technology
or full conformance claim is made. Unrelated provider/media/migration matrices
retain their historical scope, with unchanged packaged paths/dependencies.

GitHub MCP found no open repository or Dependabot PRs. Random local application
and stale cleanup/rebase were inapplicable; no PR was merged.

Next: bound password-verification admission and input size outside account locks,
preserving password-manager compatibility and current credential rechecks after
waiting. Non-password issuance/audit remains a separate later followup.
