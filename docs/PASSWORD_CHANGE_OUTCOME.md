# Atomic password change outcome

October 27, 2026. Password change now has one bounded transaction owner for
credential replacement, prior-session revocation, replacement issuance and its
required audit. Work remains on main with modular ESM services/stores, no new
dependency or schema artifact and no additional application. See
[research/tradeoffs](PASSWORD_CHANGE_RESEARCH_2026_10.md) and
[design](PASSWORD_CHANGE_DESIGN.md).

## Delivered behavior

`account-security-service.js` delegates this command to the small
`password-change-service.js`; `password-change-store.js` owns its SQL. The old
multi-commit implementation and full credential-row return were removed. The
existing authenticated POST, CSRF, response and cookie adapters remain intact.

Bounded preliminary reads capture the exact verified hash and full textual
credential epoch, including null and microseconds. Both password checks and new
hash/session preparation happen outside SQL. The existing versioned scrypt,
two-job native admission, no application queue, full-input bounds and password
minimum/failure-counter policy remain unchanged.

The write owner takes the account write lock first, then the initiating family
and exact token row. It rechecks enabled status, accepted hash/epoch, token hash,
account/family identity, current-password epoch, expiry, revocation and replacement
state. Forced-change accounts can complete the command. Current role/state comes
from the locked account result. A rotated initiating session must retry.

Credential CAS, full active-session revocation, new root-family issuance and
required audit share one client and commit together. Revocation must affect at
least one row and leave no prior active tokens before publication. The command
updates the database password timestamp and clears forced-change state. Only the
revoked-session count and selected metadata enter its audit; credential material
and full rows are never returned. Final observed parent expiry is checked before
COMMIT. Cookies follow confirmed success only.

## Executed validation

Final source: 3,740 files, SHA-256
`db0c76c14bc333be68f07da249a5b1d38bb9e7ecbee83dd42ade94c56ff6c643`.
The six changed production/test files were frozen before final validation; only
documentation followed. All three production paths match the immutable image.

Focused command `node --test test/server/password-change.test.js
test/server/account-security-service.test.js test/server/auth-routes.test.js`
passed all 33 tests. The complete fourteen `validate:fast` stages passed with
server concurrency eight: 6,280 server, 4,504 client and 703 script tests
(**11,487 total**), zero failures, cancellations or skips. Executed stages:

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
dependencies. Commands used the pinned Node toolchain; exact arguments, logs and
frozen hashes are private under `.tmp/password-change-2026-10-27/`.

Packaged `test/native/password-change.test.js` passed 27 scenarios in each fresh
2/3 GiB profile:

- Real new-password verification, old-password refusal, forced-change clearing,
  account-wide revocation and usable replacement rotation, including null epoch.
- No checkout held through KDF preparation and bounded exhausted-pool refusal
  before password work.
- Suppressed credential CAS and partial revocation roll back before publication.
- Wrong/same passwords and invalid replacement material publish no changes.
- Eight hash/precise epoch/account/token changes during preparation refuse.
- Current role projection and one winner among concurrent password changes.
- Actual account waits with rotation in both orders, replay during hashing and
  isolation of the replacement family from old-family replay.
- Old password verification cannot publish a login after the change commits.
- HTTP CSRF refusal, required-audit rollback with no cookies and ordinary success
  delivering a replacement that can refresh.
- All command writes remain invisible until commit; final observed token expiry
  rolls back every write.
- Real COMMIT with controlled lost acknowledgement changes once without retry;
  explicit new-password login succeeds afterward.
- A timed-out required audit rolls back and waits for actual backend retirement.

The immutable image also passed versioned upgrades/native password work with
15/8 scenarios at 3 GiB and auth-read/session/failure/login/rotation/replay with
16/10/20/16/15/13 scenarios at 3 GiB. Ten fresh entries total **167 scenario
executions**; all exited zero and were removed with absence verified. Source
overlay preflights are distinct from final packaged evidence. Unchanged KDF
parameters/resources retain the prior 2/3 GiB password-work proof after exact
packaged source/runtime comparison; this is not a new memory minimum or latency
claim. [Docker outcome](LOCAL_DOCKER_PASSWORD_CHANGE_OUTCOME.md) owns deployment,
browser, mounts and cleanup evidence.

## Recommendation and limits

Use the implemented stack: existing current-password/CSRF protections, bounded
read/native work, exact source/current parent checks, one atomic write owner and
confirmed-commit cookie delivery. It prevents partial changes at the tested
failure boundaries. Its cost is bounded lock contention and conservative retry
when a concurrent rotation invalidates the initiating token. Commit uncertainty
can leave a complete durable change without a returned session; no automatic
retry occurs. Explicit login with the new password is the recovery path.

Controlled barriers, triggers and post-COMMIT client decoration establish the
specified scenarios, not every interleaving or a physical network failure. The
last expiry query is a pre-COMMIT observation. Other account-management/provider/
bootstrap/claim/recovery commands retain separate ownership concerns. No complete
WCAG/NIST/FIPS conformance or new manual AT/device acceptance is claimed.

GitHub MCP queries for all open PRs and open Dependabot PRs returned empty. No PR
was available to select, implement or rebase; none was merged or closed. No
release, tag or separate branch was created.

**Next item:** bound external-provider login and make its current linked-account
admission, bookkeeping, root issuance and required audit atomic. `loginLinkedUser`
currently reads, resets counters, issues and audits separately. Preserve provider
identity validation while preventing partial outcomes and stale account/link
facts from publishing a session.
