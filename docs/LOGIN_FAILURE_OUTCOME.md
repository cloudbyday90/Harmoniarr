# Failed-login transaction outcome

October 27, 2026. Failed-login counters, lockout decisions and required audit now
share a bounded atomic account owner. Implementation stays on main without a
release or tag, using modular ESM services/stores inside the existing application.

## Delivered behavior

The failure service replaces stale lookup-row arithmetic in `auth.js`. It captures
the attempted ID/hash/exact textual credential epoch before asynchronous work,
acquires the same account write guard as successful login, then reads current
state. Eligible wrong-password attempts increment from the locked database row.
Concurrent attempts cannot overwrite one another or restore pre-success counters.

The count saturates at five without integer overflow. Threshold lockout uses
database wall-clock time plus fifteen minutes. Already-active lockouts are audited
without changing their deadline or count. An eligible new failure after expiration
can rearm the lockout; a successful login still resets counter and deadline.

Unknown, disabled, deleted and stale-credential attempts produce anonymous audit
events without counter mutation. Valid-password/current-state refusals and
already-locked password logins also reach the audit owner with counting disabled.
Password login passes an immutable credential snapshot instead of the mutable
lookup row. The auth validator now imports the small API-error module directly;
focused testing exposed and resolved its initialization cycle through auth before
the final source freeze.

Counter/lockout and `login_failed` audit commit on one client. The event contains
normalized identifier (up to 320 characters), selected user-agent (up to 512), safe
IP and fixed outcome code, excluding credentials and token material. The existing
anonymous event identity and public 401/423 behavior remain. Owner failure returns
fixed 503 `login_failure_unavailable`; no cookies or private SQL errors are sent.

The reused owner has an eight-second checkout/work deadline and SQL-local limits
of one second for locks, three seconds for statement/idle transaction and five
seconds for transaction lifetime. Before-COMMIT failure rolls back mutations and
audit. An uncertain COMMIT is not retried or reported as rollback. Admitted work
is independent of the browser connection; transport retirement remains owned.

## Executed verification

Final source: 3,725 files, SHA-256
`b3ea7e5fd3113a2fff3ed120c19ddf2abc20b2088707e355d4f3151b8c593b2f`.
All eight changed code/test files were frozen before final qualification. The five
changed production paths match the immutable image; only documentation followed.

Focused command `node --test test/server/login-failure.test.js
test/server/password-login.test.js test/server/auth.test.js
test/server/auth-routes.test.js test/server/session-issuance.test.js` passed all
48 tests. The fourteen-stage fast gate passed 6,257 server, 4,504 client and 703
script tests (**11,464 total**), with zero failures, skips or cancellations.
Server concurrency was capped at eight. Lint, ESM, copyright, migration/snapshot/
anchor checks, Compose policy, hygiene and production build passed. npm audit
reported zero vulnerabilities.

The packaged `test/native/login-failure.test.js` passed twenty scenarios:

- Six concurrent stale snapshots, exactly one lockout transition, no lost count,
  one failure audit per attempt and no session issuance.
- Active deadline preservation, expired-lockout rearm and integer saturation.
- Changed hash, microsecond epoch, null-to-epoch and epoch-to-null source refusal;
  disabled/deleted/unknown audit-only outcomes.
- Both actual success/failure admission orders, uncommitted-write invisibility,
  fresh reset state after a real account writer wait and current-counter behavior.
- Account/audit lock timeouts, required-audit rollback through HTTP, real SQL
  statement timeout, owner-deadline native backend/lock retirement and pool
  exhaustion without escaped mutations.
- Real COMMIT with controlled acknowledgement loss: one increment/audit, no
  automatic retry. This is a controlled uncertainty test, not physical network
  loss reproduction.
- Actual HTTP wrong-password/lockout refusals without cookies, audited active
  lockout with the same deadline and successful login after fixture reset.

The existing password-login, rotation and replay fixtures passed sixteen, fifteen
and thirteen scenarios on the same final image: **64 packaged scenarios total**.
All four restricted native entries exited 0, were removed and had exact absence
verified. The earlier source-overlay preflight remains separate from final
packaged evidence. See [Docker outcome](LOCAL_DOCKER_LOGIN_FAILURE_OUTCOME.md) for
inventories, live login and mount preservation. Private logs/receipts remain under
`.tmp/login-failure-2026-10-27/`.

## Recommendation and scope

Adopt immutable attempt facts, bounded transaction ownership, the shared account
write guard, current credential/lockout checks, saturated database-derived counts
and atomic required audit. Benefits are consistent lockout/reset behavior and
evidence; costs are extra queries, account contention and temporary refusal when
required audit cannot commit. See [official research and alternatives](LOGIN_FAILURE_RESEARCH_2026_10.md)
and [design](LOGIN_FAILURE_DESIGN.md).

No schema or UI change was required. The existing five-failure/fifteen-minute policy is
retained rather than claimed as a universal standard. Validation failures,
request-rate refusals and infrastructure failures before failure-owner admission
are not claimed as committed login-failure audits. Audit retention, lockout
recovery, timing-based enumeration and password-hashing resource admission were
not redesigned. No new assistive-technology or full W3C conformance claim is made.
Unrelated provider/media/migration matrices retain their historical scope; their
packaged paths and dependencies remain unchanged.

GitHub MCP found no open repository or Dependabot PRs. Random local application
and stale cleanup/rebase were inapplicable; no PR was merged.

Next: bound preliminary bootstrap and credential reads independently of these
security-write owners. Their current pool queries precede the transaction
deadline. Keep successful verification outside account locks and preserve actual
read cancellation/drainage. Non-password issuance/audit remains a later followup.

October 27 follow-up: preliminary bootstrap and credential reads now use bounded
read-only ownership, separate cancellation and actual native retirement. See the
[read design](AUTH_LOOKUP_DESIGN.md) and [outcome](AUTH_LOOKUP_OUTCOME.md). The
next-item paragraph above records this failure candidate's original scope;
password-verification resource admission and non-password issuance remain separate.
