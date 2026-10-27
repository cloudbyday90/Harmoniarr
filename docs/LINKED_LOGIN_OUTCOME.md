# Linked-provider login outcome

Followup completed October 27: [Plex callback outcome](PLEX_CALLBACK_OUTCOME.md)
records browser binding, exact single-use consumption and expiry fences in the
same local publication transaction. The evidence and original next-item note
below describe the preceding linked-login commit.

October 27, 2026. Linked Plex login now fences the current primary provider/
subject link and owns bookkeeping, root issuance and its required audit in one
bounded transaction. The implementation remains on main with modular ESM files,
no new dependency, schema artifact or additional deployed application. See
[research/tradeoffs](LINKED_LOGIN_RESEARCH_2026_10.md) and
[design](LINKED_LOGIN_DESIGN.md).

## Delivered behavior

The adapter keeps existing PIN/token/user-info verification and restricted-account
refusal outside SQL. Its full-row inline account lookup is replaced by a bounded
read returning only ID/provider/subject, with UUID preference and numeric-ID
fallback. Two internal exact subjects are admitted, each at most 256 UTF-16 code units;
invalid/missing identities do not reach issuance. No email/display-name matching
is used.

`linked-login-service.js`, its policy/store and the thin `auth.js` facade carry a
server-generated provider/subject/user descriptor into the existing write owner.
Account write locking precedes a fresh enabled/exact-link check. An unlink,
provider/subject change, disable or move to another account refuses before writes;
the helper does not retarget silently. Current role/forced-change state is used.

The extracted `login-bookkeeping-store.js` shares the unchanged successful-login
SQL with password login. Counter/lockout reset, database last-login timestamp,
root-family insertion and the required `plex_sign_in_succeeded` audit commit
together on one client. Public user/session timestamps agree. Full account rows,
provider tokens/subjects and callback state are absent from this success audit and
returned user projection. Opt-in required-audit cardinality requires one inserted
row; suppressed bookkeeping or required audit refuses publication and rolls back.
Other audit callers retain their default behavior.

`createApp` now accepts the Plex service factory through its existing composition
pattern. Production keeps the same default; the native fixture can exercise the
actual mounted callback with the real client and controlled response transport.
No public provider override or endpoint was added. Existing 303/cookie behavior
is retained, with delivery following confirmed local commit/callback completion.

## Executed qualification

Final source: 3,746 files, SHA-256
`aa0ccd1f5623a56b6c28912e73b06e2f7a66c97878a24df5e268d4cfdbd10a25`.
Thirteen production/test files were frozen before final validation. Only
documentation followed. All ten changed production paths match the immutable
image.

Focused command `node --test test/server/linked-login.test.js
test/server/plex-direct-sign-in-service.test.js test/server/password-login.test.js
test/server/auth-routes.test.js` passed all 42 tests. The complete fourteen
`validate:fast` stages passed with server concurrency eight: 6,286 server, 4,504
client and 703 script tests (**11,493 total**), zero failures/cancellations/skips.
Executed stages:

```text
npm run check:node-baseline
npm run check-copyright
npm run migration:check
npm run check:schema-snapshot
npm run check:schema-anchor-contract
npm run check:esm
npm run check:image-tags
npm run check:compose-topology
npm run lint
npm run check:test-hygiene
node --test --test-concurrency=8 test/server/**/*.test.js
node --test test/client/**/*.test.js
node --test test/scripts/**/*.test.js test/compose-image-tag-policy.test.js
npm run build
```

`npm audit --audit-level=low` reported zero vulnerabilities, including development
dependencies. Exact commands, frozen hashes and logs are private under
`.tmp/linked-login-2026-10-27/`. An earlier passing candidate gate was rerun after
removing line-ending churn; counts above describe the final gate, not summed runs.

Packaged `test/native/linked-login.test.js` passed 23 scenarios at 3 GiB:

- Real minimal UUID-priority/numeric-fallback/missing lookup and bounded pool
  exhaustion with no login writes.
- Controlled provider responses through the real Plex client, real encrypted
  pending-state storage and actual callback service, with no checkout held through
  provider calls; atomic counter/session/audit success and public projection.
- Five candidate-to-commit link/account changes, a missing current account, fresh
  subject/role after actual writer waits and independent concurrent logins.
- Account lock timeout, suppressed bookkeeping, required-audit error over HTTP,
  suppressed required-audit insertion and uncommitted visibility.
- A real COMMIT followed by controlled acknowledgement loss, with no automatic
  transaction retry or returned credentials.
- Restricted, unauthorized and empty provider responses refusing local login
  writes; ordinary HTTP callback delivering cookies after success.
- Required-audit timeout, complete rollback and actual backend retirement.

The immutable image also passed password change/hash upgrade/native password work
with 27/15/8 scenarios and auth-read/session/failure/password-login/rotation/replay
with 16/10/20/16/15/13 scenarios, all at 3 GiB. Ten fresh entries total **163
scenario executions**. Each exited zero and was removed with absence verified.
Existing KDF/resource settings remain unchanged; prior 2/3 GiB resource proof is
retained after exact packaged-source/runtime review, not claimed as new memory
minimum or throughput evidence. [Docker outcome](LOCAL_DOCKER_LINKED_LOGIN_OUTCOME.md)
owns deployment, browser, mounts and cleanup proof.

Preflight failures identified a cached statistics snapshot in the fixture's lock
observer and an ineffective auth-module override at app composition. The observer
now refreshes its snapshot, and the app has explicit Plex factory injection.
Those failed preflights are retained separately; final qualification does not use
the accidental default provider transport. A fixture shadowed variable was fixed
before the final lint/gate. No production deadlines were relaxed.

## Recommendation and limits

Use the implemented stack: verified provider identity outside SQL, bounded minimal
candidate reads, exact current link/enabled admission, common bookkeeping, borrowed
root publisher and cardinality-checked required audit under one bounded owner.
It prevents the tested partial local outcomes and stale-link publication. Its cost
is account contention and conservative refusal during link changes. COMMIT
uncertainty can leave a complete durable login without returned credentials; no
automatic retry occurs.

The provider transport is controlled; no live Plex/TLS acceptance is claimed.
Triggers/barriers and post-COMMIT client decoration establish the specified
cases, not every schedule or a physical network failure. Exact current link values
do not detect unlink/relink ABA histories or eliminate aliases linked to different
accounts. No complete WCAG/OIDC/NIST compliance or new manual AT/device acceptance
is claimed.

GitHub MCP queries for all open PRs and open Dependabot PRs returned empty. No PR
was available to apply or rebase, and none was merged or closed. No release, tag
or separate branch was created.

**Next item:** give Plex callback state a bounded, single-use completion owner,
including browser binding, expiry revalidation and atomic consumption alongside
local login publication. State reads/deletion currently remain separate; concurrent
callbacks can complete independently, and post-commit deletion failure can prevent
response delivery after a durable login. Keep provider network work outside SQL
and qualify retries, concurrent callbacks, expiry and uncertain commit explicitly.
