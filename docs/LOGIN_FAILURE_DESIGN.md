# Failed-login transaction design

October 27, 2026. Move failed-login orchestration out of `auth.js` into an ESM
service and SQL store. Reuse successful login's account write guard and the
existing session-write transaction owner; add no schema or service container.
The auth validator imports the small API-error module directly, removing its
initialization cycle through the auth composition module.

Capture account ID/hash/exact textual credential epoch, selected request metadata
and normalized identifier before asynchronous verification or transaction waits.
The failure owner reads current account state after acquiring write eligibility.
Only an enabled, unlocked account matching that credential snapshot can receive
a wrong-password increment. A valid-password refusal explicitly opts out of
counter mutation. Disabled/unknown/stale/deleted and already-locked attempts still
have anonymous failure audits; no caller-supplied counter value is authoritative.

The SQL update derives the next count from the locked row, saturating at five
without integer overflow. At threshold it uses database wall-clock time plus
fifteen minutes. An active lockout causes no update, preserving its exact deadline.
Expired locks can be rearmed by a new eligible wrong-password attempt; a successful
login continues to reset the counter/lockout under the same write guard.

Counter, lockout and required `login_failed` audit share one client and commit.
Audit contains normalized identifier (at most 320 characters), selected user-agent
(at most 512 characters), safe IP and a fixed outcome code. It excludes credential
material and raw errors. Locked and current-state-refused password logins also
delegate to this audit owner without counter mutation. Existing 401/423 responses
remain; owner failures use fixed 503 `login_failure_unavailable`.

The eight-second owner and transaction-local SQL limits remain unchanged. Browser
disconnect cannot abandon admitted security writes. Before-COMMIT errors roll
back; unknown COMMIT outcome refuses normal publication with no automatic retry.
Actual transport retirement remains the existing owner's responsibility.

Qualification must include concurrent stale snapshots, fifth-failure lockout,
active/expired deadlines, integer saturation, both success/failure admission
orders, credential/reset writer waits, audit rollback, pool/lock/SQL admission,
deadline drainage, controlled commit uncertainty and real HTTP refusals.

See [research/tradeoffs](LOGIN_FAILURE_RESEARCH_2026_10.md) and
[outcome](LOGIN_FAILURE_OUTCOME.md).
