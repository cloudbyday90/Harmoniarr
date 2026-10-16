# PostgreSQL queued checkout observation design

Date: 2026-10-16. Scope: owned integration fixture diagnostics.

The [root test lane outcome](WANTED_ROOT_TEST_LANES_OUTCOME.md) preserves two
different checkout failures: an unobserved wait during an HTTP settings mutation,
and a cold client that dispatched startup without observed authentication. Later
healthy probes cannot identify either original cause. This change closes the
queued-client attribution gap; it does not claim to repair either stall.

## Ownership and boundaries

The reviewed pg 8.23.0 / pg-pool 3.14.0 implementation appends one PendingItem
synchronously during queued connect, then promotes that exact object through
newClient or _acquireClient. A narrow owned-instance adapter maps that identity
to the checkout. Immediate creation consumes one synchronous dispatch admission
before invoking driver hooks. Queued promotion uses the saved item, never the
releasing client's async context. Unknown items get no construction owner.

Queue inspection accepts only a normal bounded array with an unchanged prefix
and one appended item. Unsupported driver versions, custom pool/client methods,
and ambiguous shapes retain ordinary acquisition behavior with unavailable
evidence. No queue entries, callback identities, client objects, configuration,
SQL, payloads, credentials or native messages enter output.
Unsupported pool methods also suppress synchronous construction attribution;
an unreviewed custom connect cannot supply a cold-client owner by calling the
ordinary Client constructor during its invocation.

Version-three checkout records add a minimized acquisition record: queued,
creating_client, acquire_entered and delivered, with monotonic offsets and new
or reused classification. Entry into _acquireClient precedes optional verify
and callback delivery; it is deliberately distinct from delivered. A reused
client gets acquisition evidence without fabricated cold startup milestones.
Existing connection and server records keep their own versions and meanings.

The adapter decorates only two methods on the owned pool; it neither replaces
the queue nor changes release, timeout, pool size, retry or scheduling policy.
It restores original descriptors and removes mappings at settlement/restoration.
Known failure capture still drains before fixture cleanup, retaining Error/null.
There are no production, schema, dependency or application authorization changes.

## Options and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Counters/public acquire events | Stable and cheap | Cannot bind a failed cold client to its waiter | Retain as context |
| Actual pending-item adapter | Identifies queued promotion before startup and distinguishes reuse | Version-dependent internal surfaces; narrow native controls required | Implement |
| Ambient async context alone | Easy to attach to spans | Release-time context can belong to another checkout | Reject for ownership |
| Global driver/socket hooks | Broad visibility | Cross-owner interference and sensitive payload exposure | Reject |
| More clients, longer deadlines or retries | May reduce visible failures | Changes pressure and conceals unknown failures | Reject |

First implement explicit waiter ownership, then prove native queued cold creation,
reuse, callback/query behavior and held timeout. Keep the independent startup
investigation next: dispatch is not proof of server receipt, authentication or
backend readiness. HTTP phase attribution also remains a separate boundary.
See [research](POSTGRES_QUEUED_CHECKOUT_RESEARCH_2026_10.md) and
[outcome](POSTGRES_QUEUED_CHECKOUT_OUTCOME.md).
