# Preliminary authentication read design

October 27, 2026. Route bootstrap existence and initial password-credential
selection through the existing session-read transaction owner. Add a small ESM
auth lookup adapter and bootstrap SQL store; keep credential SQL in its current
store, requiring an explicitly borrowed client instead of defaulting to the pool.

The adapter fixes the public failure code to `auth_lookup_unavailable`. Reuse the
eight-second owner deadline, one-second lock, three-second statement/idle and
five-second transaction limits. Each read uses READ COMMITTED READ ONLY and
returns only after acknowledged rollback/release. Failed or uncertain cleanup
cannot publish facts. Deadline/abort callers can finish earlier than native
drainage; late clients are retired without executing application SQL.

Extract the existing unfinished-response-close signal helper and reuse it for
session reads, bootstrap status and login. Normal request-body completion is not
cancellation. Bootstrap status forwards the signal only to its existence read;
login forwards it only to preliminary bootstrap/credential reads. Password
verification and required security-write owners do not consume that signal.
Closing the browser after those reads cannot abandon admitted security writes.

Bootstrap wrappers used by other existing callers also become bounded, with
optional cancellation. Invalid existence facts or database failures never mean
an empty user table. The existing bootstrap-first validation order, selected
credential columns, username/email normalization and current-state write guards
remain. No new cache, global pool setting, migration or service container is added.

Qualification covers true/false bootstrap, username/email/missing credential
facts, pool exhaustion, held-table SQL, statement deadlines, actual HTTP
disconnect, late checkout/rollback/close failure, native backend retirement,
read-only refusal and unchanged settings. Verify hashing begins after client
release and read cancellation cannot cancel security writes. Requalify existing
session and login/failure/rotation/replay contracts on the final packaged image.

See [research/tradeoffs](AUTH_LOOKUP_RESEARCH_2026_10.md) and
[outcome](AUTH_LOOKUP_OUTCOME.md).
