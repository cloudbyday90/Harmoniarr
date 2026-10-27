# Versioned password hashes and guarded login upgrades

Date: October 27, 2026. Scope: existing application, ESM modules, no new service,
dependency, schema migration or release. [Research and tradeoffs](PASSWORD_HASH_RESEARCH_2026_10.md).

## Record policy

`password-hash-policy.js` owns immutable allowlisted profiles, bounded parsing,
current formatting and upgrade eligibility. Stored text cannot set arbitrary
native costs. Only these complete records are accepted:

```text
scrypt$<32 hex salt>$<128 hex key>
scrypt$v2$n=16384,r=8,p=5$<32 hex salt>$<128 hex key>
```

The legacy profile uses N=16384/r=8/p=1. The current profile uses
N=16384/r=8/p=5. Both use 64-byte output and 32 MiB maxmem; salts are generated
from 16 random bytes and passed as hex strings to preserve the legacy convention.
Only the new profile is generated. Unknown versions, alternate parameter sets,
extra fields and malformed/oversized records refuse before KDF admission.

`password-work-service.js` selects native parameters from the policy descriptors.
Existing `security.js` exports remain compatible, so every caller generating a
password hash receives the versioned profile. The shared two-job limit, no queue,
slot lifetime through native completion and private errors remain intact. Input
is never trimmed, normalized or truncated; the existing validation bounds remain.

## Upgrade ownership

Successful password verification captures immutable account ID, hash and textual
credential epoch. Only valid legacy records need rehashing. Derivation and
prepared-material validation happen before taking a transaction checkout/lock.
Failure or overload at this stage publishes no login writes or failure counter.

The existing bounded security-write owner locks the account in write mode and
rereads current enabled/lockout/hash/epoch state. Source drift refuses issuance.
The SQL-only login store conditionally replaces exactly that hash and epoch and
requires one affected row. Password hash, successful-login bookkeeping, root
session insertion and required login audit then commit together. Required audit
failure rolls back the upgrade as well. Commit uncertainty does not trigger an
automatic derivation, transaction or credential-publication retry.

The upgrade changes `password_hash` and `updated_at`, preserving
`password_changed_at`, including null and PostgreSQL microseconds. The secret
has not changed, so existing sessions and their password-epoch guards remain
valid. Only upgraded logins add `passwordHashUpgraded: true` and the public
`scrypt-v2` profile ID to the normal login audit; hashes and passwords never enter
the audit or user projection.

## Concurrency, deployment and limits

Two legacy logins can prepare replacements concurrently. One wins the guarded
publication. The other sees a changed source and returns the existing credential
refusal without increasing the failure counter or overwriting the winner.
An explicit retry verifies the new profile. This conservative behavior keeps the
exact-hash guard; it does not infer that matching timestamps prove equal secrets.

Version metadata fits the existing TEXT column. There is no table rewrite or
maintenance task that can upgrade hashes without a supplied password. Legacy
accounts upgrade when they successfully log in or set/reset their password.
Idle-account policy remains a later product decision.

Deploy this reader/writer together in the existing application. Older binaries
cannot verify v2 records; rolling back to one after v2 writes is unsafe. Keep
the compatible reader when rolling forward or repairing the deployment; do not
downgrade stored hashes. More CPU can increase latency and busy responses under
load. The two-job limit and nominal algorithm memory are not a total RSS bound.

## Verification

Focused tests exercise profile selection, an independent p=5 crypto oracle,
invalid cost admission and prepared upgrade fences. The guarded native fixture
uses a real legacy oracle and PostgreSQL to test exact epochs, existing session
rotation, hashing outside checkout, races, stale/reset/restricted accounts,
required-audit rollback, uncommitted visibility and controlled commit-ack loss.
Actual shared native work remains qualified in both 2/3 GiB profiles. The fast
gate and fresh image retain affected read/failure/login/rotation/replay coverage.

Results and next task: [implementation outcome](PASSWORD_HASH_OUTCOME.md).
Deployment ownership: [local Docker design](LOCAL_DOCKER_PASSWORD_HASH_DESIGN.md).
