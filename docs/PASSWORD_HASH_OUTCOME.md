# Versioned password hash outcome

Followup on October 27: the recommended password-change owner is implemented in
the [change design](PASSWORD_CHANGE_DESIGN.md) and [outcome](PASSWORD_CHANGE_OUTCOME.md).
Credential replacement, old-session revocation, replacement issuance and required
audit now share one bounded current-credential/current-parent transaction.

October 27, 2026. The existing application now generates versioned scrypt hashes
and upgrades legacy hashes during successful password login. Work remains on
main with modular ESM files and no new service, dependency or schema migration.
See [research/tradeoffs](PASSWORD_HASH_RESEARCH_2026_10.md) and
[design](PASSWORD_HASH_DESIGN.md).

## Delivered behavior

The current allowlisted profile is N=16384/r=8/p=5, 64-byte output, 32 MiB
maxmem and 16 random salt bytes. The encoding records the version and costs.
Legacy N=16384/r=8/p=1 records still verify with their original parameters.
Malformed records, unknown versions and arbitrary cost changes refuse before
native admission. A separate policy file owns parsing/profile selection;
`password-work-service.js` retains the shared two submitted jobs, zero application
queue and actual-completion lifetime. No input trimming, normalization or
truncation was added; the 4096-byte cap and existing minimum remain unchanged.

After valid legacy verification, login prepares and validates new material before
taking a SQL checkout. The account lock and exact verified hash/full textual
epoch comparison fence credential resets and account restrictions. The store's
conditional replacement requires one affected row. Hash upgrade, login
bookkeeping, root session and required login audit commit together. The audit
adds only the upgrade flag/profile identifier. No credential material enters it.

The password epoch, including null and microseconds, is preserved because the
secret is unchanged. Existing sessions remain usable and can rotate. Concurrent
legacy upgrades permit one winner; the stale contender refuses without a failure
counter penalty, and an explicit retry succeeds against the current profile.
Required audit failure rolls back all writes. Uncertain commit acknowledgement
does not automatically retry or deliver generated credentials.

## Executed qualification

Final code source: 3,736 files, SHA-256
`eca923278f550161224eb66cc490f68da4d8423c168a77f18f28072c1bd29aba`.
All eight changed code/test files were frozen before final qualification. Only
documentation followed. The four production paths match the immutable image.

Focused command `node --test test/server/password-work.test.js
test/server/password-login.test.js` passed all 16 tests. Independent native
scrypt oracles verify both legacy records and actual current-profile output.
The complete fourteen `validate:fast` stages passed, using server concurrency
eight: 6,272 server, 4,504 client and 703 script tests (**11,479 total**), with
zero failures, cancellations or skips. Executed stages were:

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
dependencies. Actual commands ran through the pinned Node toolchain and private
driver under `.tmp/password-hash-2026-10-27/`; logs retain exact arguments.

Packaged `test/native/password-hash-upgrade.test.js` passed 15 scenarios in each
fresh 2/3 GiB profile: independent legacy/new-bootstrap records; exact microsecond
and null epochs with existing-session rotation; hashing outside checkout; wrong
password and invalid replacement refusal; six source/account changes during
preparation; simultaneous upgrades with explicit retry; audit rollback over HTTP;
uncommitted visibility; and real COMMIT with controlled acknowledgement loss.

Packaged `test/native/password-work.test.js` retained eight scenarios per profile:
real legacy/full Unicode verification, exact 4096-byte boundaries, real shared
admission saturation, pre-admission invalid inputs, no-write HTTP overload/input
refusal, disconnect slot retention and ordinary login after retirement. Sampled
app RSS during the native saturation fixture was 171,626,496 bytes at 2 GiB and
171,134,976 bytes at 3 GiB. These are local process observations, not cgroup peaks,
minimum deployments or production latency claims.

The immutable image also passed auth-read/session/failure/login/rotation/replay
entries with 16/10/20/16/15/13 scenarios at 3 GiB. Across ten fresh entries this is
**136 scenario executions**. Containers exited zero, were removed and checked
absent. Controlled barriers and post-COMMIT transport decoration establish the
specified ordering/refusal cases; they are not physical network-fault or exhaustive
scheduler reproductions. [Docker outcome](LOCAL_DOCKER_PASSWORD_HASH_OUTCOME.md)
owns packaged comparison, preserved mounts, browser and cleanup results.

## Recommendations and remaining limits

Use the implemented stack: bounded asynchronous native scrypt, versioned
allowlisted profiles, exact-source atomic upgrade, private audit/cookie delivery
and unchanged password-manager-compatible input. It improves stored password
defense while retaining nominal algorithm memory; extra CPU can increase latency
and busy responses. Total process memory is not bounded by scrypt maxmem.

Idle accounts retain legacy hashes until successful login or password reset.
Maintenance cannot derive stronger hashes without the secret. Older binaries
cannot verify v2: retain the compatible reader during any rollback/repair and do
not downgrade hashes. No NIST/FIPS or complete WCAG conformance is claimed;
manual assistive-technology/physical-device acceptance remains deferred.

GitHub MCP queries for all open PRs and open Dependabot PRs both returned empty.
No PR could be randomly selected, applied or rebased, and none was merged or
closed. No release/tag was created.

**Next item:** make account password change a bounded current-credential-owned
transaction. `account-security-service.js` currently verifies, updates, revokes,
issues and audits through separate steps. Prepare hashing outside SQL, then fence
the verified hash/epoch and atomically replace the credential, revoke/reissue
sessions and record the required audit under compatible account/family ownership.
Qualify stale-password races, audit rollback, concurrent rotation and uncertain
commit before delivery of replacement cookies.
