# Password login transaction outcome

October 27, 2026. Password login now binds the exact verified credential state to
successful-login bookkeeping, root-session issuance and its required audit in one
bounded transaction. Implementation stays on main with no release or tag.

## Delivered behavior

The narrow ESM login service/store replace the password-login body in `auth.js`.
Password verification remains outside database transaction ownership. Immutable
accepted facts contain the selected account ID, verified hash and exact textual
credential epoch, preserving null and PostgreSQL microsecond precision.

The transaction takes the existing account guard in write mode, then reads current
state through a new READ COMMITTED statement. Changed hash/epoch or unavailable
account produces the existing generic invalid-credential refusal. Current lockout
is checked before any write. Current role and forced-password-change state are
preserved in the response, rather than projecting the old lookup row. Write mode
at first admission serializes simultaneous logins without shared-lock upgrades.

Login counters/last-login time, new-family token and `login_succeeded` audit commit
together on one client. A small borrowed-root helper preserves the existing
account-before-family issuance protocol without nesting transaction owners.
Passwords, hashes, credential epochs and token secrets are omitted from the audit
and returned account object. Metadata uses the existing bounded selector.

The existing session-write owner retains eight-second checkout/work admission,
one-second lock, three-second statement/idle-transaction and five-second SQL
transaction limits. Audit failure rolls back bookkeeping and issuance. Unknown
COMMIT outcome returns a fixed temporary refusal without cookies or automatic
retry. The initial credential lookup and password verification precede that
transaction deadline; no whole-login latency guarantee is claimed.

## Executed qualification

Final source fingerprint: 3,721 files, SHA-256
`241cb39a30882708c33eef2f25b16a36f80d4a7a4a650282e46e789258afde47`.
All seven changed code/test files were frozen before final qualification. The five
production files match the immutable packaged image; only documentation followed.

Focused login/issuance/auth/route tests passed all 45 tests. The final fourteen-stage
fast gate passed 6,252 server, 4,504 client and 703 script tests (**11,459 total**),
with zero failures, cancellations or skips. Lint, ESM, copyright, schema/migration/
anchor checks, Compose policies, hygiene and production build passed. npm audit
reported zero vulnerabilities. Server test concurrency was capped at eight.

The packaged `test/native/password-login.test.js` passed sixteen scenarios:

- Actual password/email login, session usability and atomic bookkeeping/audit.
- Verified-source changes: hash, microsecond epoch, null-to-epoch, epoch-to-null,
  disabled state and lockout, all refusing without successful-login writes.
- Real account-writer waits followed by a changed password or current role/
  forced-change state, plus simultaneous successful logins and lock timeout.
- Required-audit failure through HTTP: no cookies, fixed private-safe error and
  unchanged bookkeeping/session/audit state.
- All three writes invisible before COMMIT, then visible together; actual COMMIT
  with controlled acknowledgement loss refusing publication without a retry.
- Owner deadline during actual audit SQL, verified native backend retirement and
  rollback, followed by ordinary HTTP login/cookie success.

The unchanged rotation and replay fixtures passed all fifteen and thirteen
scenarios respectively on the same final image. Those retain family fencing,
required-audit rollback, duplicate refresh/replay, expiry, lock/SQL deadlines,
pool exhaustion, native retirement and cookie/CSRF controls. The commit-loss
wrappers execute real COMMIT and suppress its acknowledgement; they are controlled
uncertainty tests, not reproductions of physical network loss.

All three restricted native entries exited 0 and were removed with exact absence
verified. The earlier source-overlay login preflight is separate from final
packaged evidence. See the [Docker outcome](LOCAL_DOCKER_PASSWORD_LOGIN_OUTCOME.md)
for inventories, preserved administrator/mounts and live browser checks.
Private receipts/logs remain under `.tmp/password-login-2026-10-27/`.

## Recommendation and limits

Adopt verification outside SQL, exact accepted credential comparison under the
account write guard, fresh account admission, atomic bookkeeping/session/audit,
then cookie delivery after acknowledged commit. Benefits are a short transaction
and consistent credential/audit authority. Costs are same-account serialization,
extra queries and temporary refusal under contention or uncertainty. See the
[research and alternatives](PASSWORD_LOGIN_RESEARCH_2026_10.md) and
[design](PASSWORD_LOGIN_DESIGN.md).

No schema, UI, cookie policy or new service container was needed. Existing W3C
password-manager/paste behavior remains applicable; no new screen-reader,
physical-device or full accessibility conformance claim is made. Unrelated
provider/media/migration matrices were not rerun; historical evidence keeps its
original scope, supported by unchanged packaged bytes/dependencies for those paths.

GitHub MCP found no open repository or Dependabot PRs. Random local implementation
and stale cleanup/rebase were inapplicable; no PR was merged.

Next: put failed-login counters/lockout and required failure audit under a bounded
atomic account owner. The current failure helper computes its count from a stale
lookup row, so concurrent failures can be lost. Bootstrap and external-provider
issuance/audit ownership require separate followups rather than a fabricated
password-verification contract.
