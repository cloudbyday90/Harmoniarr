# PostgreSQL startup write observation design

Date: 2026-10-16. Scope: owned integration fixture diagnostics, following the
[queued-checkout outcome](POSTGRES_QUEUED_CHECKOUT_OUTCOME.md).

The original failed client dispatched startup without observed authentication.
That marker says the driver method returned; it does not establish local write
completion or PostgreSQL receipt. Observe the original owned stream's startup
write callback separately from transport, authentication and backend readiness.

## Implementation boundary

Keep the reviewed pg 8.23.0 / pg-pool 3.14.0 guards and exact PendingItem ownership.
Observe only the native connection.startup method and an ordinary Node Socket or
TLSSocket with native write methods. Temporarily decorate that instance's write
only during startup's synchronous call; restore its descriptor immediately in
finally. Do not hook global prototypes, auth/query writes, custom startup methods
or custom stream implementations. Admit only plain data packets with bounded
string fields, so accessors/coercions cannot inject unrelated writes inside the
serializer. Unsupported evidence stays explicitly unknown.

The native method writes one Buffer without a callback. Pass the same Buffer,
receiver and native return value, adding one nonthrowing observation callback.
Record attempted/returned/callback monotonic offsets, return outcome, callback
outcome and backpressure separately. A false write return is flow control, not
failure. Callback success describes local Node write completion, not remote
receipt, TCP acknowledgement, authentication or query readiness.

Connection records become version two with a bounded startupWrite subtree;
outer checkout and server record versions stay unchanged. Persist approved
enums, finite durations and sanitized error code/class only. Never inspect/copy
serialized packet bytes or retain configuration, credentials, error messages or addresses
in output. Preserve original Error/null, method receiver and result. Late or
duplicate callbacks cannot update a settled observation. Optional diagnostics
must not replace original driver failures or add retry/timeout/capacity policy.
Capture each output scalar once before validating it, so a changing getter cannot
substitute an unapproved value between validation and serialization.

## Options and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Existing startup-dispatched marker | Minimal instrumentation | Cannot locate the local write boundary | Retain |
| Owned temporary startup write callback | Observes original local completion without payload parsing | Internal startup shape needs version review; callback is still not remote proof | Implement |
| Permanent/global socket tracing | Broad traffic visibility | Cross-owner interference, auth/query exposure and attribution risk | Reject |
| Infer receipt from return true or a later healthy probe | Cheap | Does not establish original remote progress | Reject |
| Increase pool/deadlines or retry | May hide symptoms | Changes the failing workload before cause is known | Reject |

Use explicit queued ownership, reviewed local-write observation, separate server
association and targeted native adverse controls. Prove held callback, callback
error, synchronous Error/null, receiver/Buffer/return preservation, native held
startup without authentication, successful PostgreSQL query paths, and cleanup.
Keep the historic failures and HTTP request-phase gap separate. See
[official research](POSTGRES_STARTUP_WRITE_RESEARCH_2026_10.md) and
[outcome](POSTGRES_STARTUP_WRITE_OUTCOME.md).
