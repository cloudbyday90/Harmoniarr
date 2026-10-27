# Session replay transaction design

October 27, 2026. Implements the follow-up from
[pool/session admission](POOL_SESSION_ADMISSION_OUTCOME.md).

`auth.js` continues to reject absent, disabled, expired and revoked sessions. A
revoked token with a replacement delegates to `session-replay-service.js`. The
service captures server-observed token/user/family identities and selected request
metadata before waiting. Raw cookie, CSRF and token-hash values are not passed to
the write store or audit.
Audit IPs must be plain valid IPv4/IPv6; malformed addresses and IPv6 zone IDs
become null rather than failing PostgreSQL INET conversion and vetoing the
security transaction. User-agent metadata must be text. Syntactic IP validity
does not authenticate a forwarded address or establish a trusted proxy.

`session-replay-store.js` owns a parameterized public-qualified UPDATE. It rechecks
the observed token's identity, revoked/replaced state, expiry and enabled owner;
it updates only that owner's still-active family rows. Returned changed rows own
the audit decision. The event uses the current stored previous revocation reason.
No active rows means no duplicate audit. No schema change is needed.

`session-replay-transaction-service.js` owns one ordinary pool checkout. It sets
local database timeouts, runs revocation and the required existing audit writer
on that client, then requires COMMIT acknowledgement and idle transaction status.
Precommit failures require acknowledged ROLLBACK before reuse. Failed rollback,
dirty entry, transport loss, deadline and uncertain COMMIT force retirement through
the existing pg-specific transport adapter. Failed close retains checkout ownership
and its error listener until transport end, rather than declaring capacity free.

The task exposes caller result separately from actual drainage. It has an
independent 8-second deadline and no browser-abort signal. A late pool delivery
performs no SQL. Checkpoints prevent audit/COMMIT after deadline; an in-flight
COMMIT is uncertain and is never retried. Successful database acknowledgement
cannot be equated with human receipt of an HTTP response.

READ COMMITTED concurrent UPDATE reevaluation provides a single changed-row winner
for the same existing active rows. Audit failure rolls those changes back. This
is not a family tombstone protocol: future issuance/rotation remains the next
separate owner to fix. Ordinary login/logout/rotation SQL, global query settings,
schema diagnostics, frontend, workers and provider configuration remain unchanged.

Validation targets actual PostgreSQL rollback, duplicate contention, both lock
boundaries, current-source refusal, deadline backend retirement, HTTP disconnect,
and durable replay after a controlled lost commit acknowledgement. Unit tests
cover late checkout, original Error/null, no post-expiry commit, failed cleanup
and exact client/selected input ownership. Deployment uses the existing single
walkthrough app with all five inspected mounts and existing administrator.

See [research](SESSION_REPLAY_RESEARCH_2026_10.md) and
[outcome](SESSION_REPLAY_OUTCOME.md).
