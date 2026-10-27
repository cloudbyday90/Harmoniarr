# Session rotation design

October 27, 2026. Completes the descendant-issuance follow-up from
[session replay](SESSION_REPLAY_OUTCOME.md) without a schema migration.

`session-write-transaction-service.js` extracts the existing qualified replay
owner. The replay adapter retains its public error code; issuance uses
`session_write_unavailable`. Both keep 8s application ownership, 1s lock, 3s
statement/idle and 5s transaction limits, explicit rollback/commit acknowledgement,
native transport retirement and separate result/drainage. Browser disconnect
does not abandon an admitted security transaction; uncertain COMMIT never retries.

`session-family-lock-store.js` reuses the stable account eligibility lock and
reads account facts in a separate statement after waiting. Lock order is account
FOR SHARE, family advisory transaction lock, parent FOR UPDATE. The family key
is the signed first 64 bits of SHA-256 over a fixed namespace and lowercase UUID;
a hash collision serializes unrelated families and does not grant authority.
Every parent/token/owner comparison remains parameterized SQL. One family lock
is acquired per transaction; no lock list or per-family memory registry is kept.

`session-issuance-service.js` captures identity/hash, selected metadata and fresh
opaque material before waiting. Root issuance always creates a new family and
rejects supplied family/parent grafts. Rotation rechecks the live owner and parent,
including microsecond-preserving password epoch and current database-clock expiry.
The store owns child insertion, parent active/unlinked CAS and final expiry check.
Required `session_rotated` audit shares the transaction and contains row identities,
not raw refresh/CSRF tokens or their hashes. Invalid audit IPs become null.

If a parent is already rotated, the service invokes the transaction-bound replay
writer under its existing locks. It commits revocation/audit and returns 401 only
after acknowledgement. It never nests a checkout or throws away the security
write by rolling back an authentication refusal. Other prewrite refusals commit
no changes before 401/403. Postwrite guard failure rolls everything back and
returns fixed 503. Current user facts are returned for the refresh response.

The HTTP refresh adapter now applies the existing CSRF guard before calling the
issuer or setting cookies. The API still uses the same endpoint, cookie contract,
rate limiter and response shape. No automatic retry is introduced. Concurrent
legitimate refreshes follow strict replay policy and can require signing in again.

Replay-first revokes the live parent before a waiting rotation can inspect it;
rotation-first commits its child before replay's fresh UPDATE snapshot can revoke
it. Both hold the family lock through commit. Root insertion cannot join an
existing family, so it cannot introduce a late descendant outside this protocol.

Old binaries must stop during adoption. Other revocation writers are inventoried
in the research scope and are not certified by this family protocol. Root login's
earlier credential verification and separate login audit remain the next owner.

Verification uses real PostgreSQL orderings, rollback, required-audit failure,
account/family/parent waits, precise password epoch, final expiry, native deadline,
controlled lost commit acknowledgement and real HTTP CSRF/refusal/cookie behavior.
The existing single walkthrough is rebuilt without cache, preserving the existing
administrator and all five actual bind mounts.

See [research](SESSION_ROTATION_RESEARCH_2026_10.md) and
[outcome](SESSION_ROTATION_OUTCOME.md).
