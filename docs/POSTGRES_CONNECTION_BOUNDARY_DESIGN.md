# PostgreSQL cold connection boundary design

Date: 2026-10-13. Scope: owned integration fixture diagnostics. No production
pool, schema, timeout, capacity, retry, release or scheduling changes.

The bounded-root workload's original cold application checkout timed out after
about ten seconds. Admission counters were 0 total/0 waiting, then 1 total/0
waiting, then 0 total/0 waiting. An independent authenticated query, readiness
probe and container state succeeded afterwards. Those records cannot identify
the original client's target or connection stage. The historical cause remains
unknown; a later passing control cannot replace its failed collection.

## Chosen boundaries

`pg-connection-record.js` privately captures host, numeric port, database and
user from the acknowledged scenario configuration, then compares the actual
constructed client's resolved scalar values. Output contains only matched,
mismatched or unavailable. It neither compares passwords nor proves DNS aliases,
remote server identity, certificate validity or authorization.

`owned-pg-connection-observer.js` decorates only the owned pool's Client factory,
preserving the concrete driver client and constructor behavior. It accepts the
reviewed pg 8.23.0 / pg-pool 3.14.0 JavaScript implementation and its protocol
connection. Unsupported versions/custom factories retain ordinary checkout
diagnostics with an explicit unsupported status. No prototype or global hooks.

Only a client constructed during that checkout's synchronous native dispatch is
associated with it. Queued or reused clients remain not observed. A later queue
promotion can run in another client's release context; ambient async context
cannot safely establish ownership. Existing queue counters remain available.

Fixed milestones use monotonic offsets from checkout admission: construction,
transport connection, TLS stream creation, TLS secureConnect, startup dispatch,
authentication request/acceptance and backend ReadyForQuery. The adapter observes
event names without reading payloads. The owned startup method wrapper records
only after the original returns; dispatch does not prove bytes reached the
server. pg sslconnect means TLS stream creation, not completed TLS negotiation.
No stage or duration alone identifies the cause of a stall.

The existing observer emits version-two owned checkout records before independent
failure probes. First-app schema records keep their separate version-one schema.
Promise, callback and pool.query acquisition paths retain original clients,
callback receiver/release values and original Error/null. Failure-only output
and the existing 16-failure/128-ordinary record bounds remain. No configuration,
SQL, names, addresses, credentials, backend keys, payloads or error messages enter
the new record. Invalid clocks/fields become unavailable.

Listeners and startup decoration are removed at settlement; restoration drains
existing failure captures and restores the owned Client descriptor before pool
cleanup. A later owner of a startup method is never overwritten. Optional
diagnostic failures cannot replace the original driver outcome. Lazy application
pool creation and both application fixture entrypoints remain intact.

## Options and final recommendation stack

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Public pool events only | Stable documented surface | Connect event follows successful startup; misses cold failure | Keep counters, insufficient alone |
| Owned version-checked driver adapter | Original client, target comparison and startup milestones | Internal surfaces need explicit review after driver upgrades; queued clients unassociated | Implement |
| Global socket/prototype tracing | Broad connection visibility | Cross-owner attribution and sensitive-data exposure; changes unrelated connections | Reject |
| Longer timeout / more clients / automatic retry | Could hide symptoms | No causal evidence; changes pressure and failure semantics | Reject |

Use owned checked instrumentation plus existing independent server snapshots;
prove real startup hold and successful native acquisition; keep privacy and
failure preservation in maintained standards/testing skills. Then run only the
missing noise 48/96 receipt profiles, two alternating pairs each, with unchanged
resource limits and exact result/hash/byte comparisons. Retain every failed or
partial collection separately. See the [research](POSTGRES_CONNECTION_BOUNDARY_RESEARCH_2026_10.md)
and [outcome](POSTGRES_CONNECTION_BOUNDARY_OUTCOME.md).
