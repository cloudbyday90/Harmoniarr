# Pool and session admission research

Reviewed October 27, 2026. Official URLs were discovered/opened through the
connected search service. Repository PR metadata/diffs came from GitHub MCP.
The limits below are application design choices inferred from those sources.

## Sources and applicable practices

- [node-postgres pool API](https://node-postgres.com/apis/pool): connection timeout
  defaults to zero; checkout can wait for capacity. Bound that wait and release
  every owned checkout. Preserve both documented callback and promise APIs.
- [node-postgres client API](https://node-postgres.com/apis/client): distinguish
  client-call timeouts from connection lifecycle and transaction status. Rejecting
  a caller is insufficient evidence that its SQL or transport retired.
- [PostgreSQL 18 timeout settings](https://www.postgresql.org/docs/18/runtime-config-client.html):
  statement, lock and transaction timeouts cover different boundaries. Apply
  local read limits instead of imposing a blanket timeout on application writes.
- [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html):
  deny on failed authority checks and validate permissions on every request.
  Preserve fresh database role/revocation reads; never cache a previous successful
  authorization to hide an availability failure.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html):
  availability feedback should remain programmatically determined without moving
  focus. Preserve existing diagnostic status/retry behavior. A service outage is
  distinct from an invalid session and must not invoke the client's auth reset.
- [slskd releases](https://github.com/slskd/slskd/releases),
  [Docker guidance](https://github.com/slskd/slskd/blob/master/docs/docker.md) and
  [configuration](https://github.com/slskd/slskd/blob/master/docs/config.md?plain=1):
  0.26.2 includes queue and access-level changes. Qualify actual wire identity and
  transfers with the existing restricted API key and isolated native fixture;
  retain production least privilege and avoid enabling memory dumps.

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Native checkout timeout alone | Small change, native waiter removal | Bursts can still accumulate many pending checkouts | Add a count cap too |
| Finite pending checkouts plus native timeout | Bounds retained admission work and waiting time | Overload is refused; capacity needs deliberate sizing | Adopt, default 64 pending and 5 seconds |
| Global query-call timeout | One configuration field | Can abandon mutations or return clients with SQL still running | Reject |
| Local read-only session transaction plus owner deadline | Fresh authority, bounded SQL and actual transport cleanup | Additional transaction messages per authenticated read | Adopt |
| Session result cache or separate auth pool | Can reduce latency or isolate contention | Stale authorization or extra connection budget; does not bound ordinary work | Defer |

## Final recommendation stack

1. Existing pg Pool with a 5-second native checkout/startup default; preserve valid
   explicit overrides and refuse malformed or overflowing timer configuration.
2. A public-connect adapter limiting unresolved checkouts to 64 per pool
   generation. Native `pool.query` uses the same gate; active clients remain
   governed by the native pool maximum. No refusal queue or retry is added.
3. Read session rows on one checked-out client in a read-only Read Committed
   transaction: lock 1 second, statement/idle 3 seconds, transaction 5 seconds.
4. One 8-second owner deadline covering checkout, SQL and cleanup. Cancel on
   unfinished response disconnect, destroy/await the owned transport on expiry,
   discard late deliveries, and return only after acknowledged normal rollback.
5. Safe retryable 503 responses, existing 401/403 semantics for completed authority
   checks, no stale role cache and no client logout for temporary unavailability.
6. Qualify the selected PR separately through real provider contracts and retain
   explicit evidence limits for long-running timeout/debug behavior.

Timers remain subject to event-loop and OS scheduling. Ordinary active queries,
transactional writes and rotated-token replay revocation/audit are separate
lifetimes. Do not claim that checkout bounds limit all application SQL.

See [design](POOL_SESSION_ADMISSION_DESIGN.md),
[outcome](POOL_SESSION_ADMISSION_OUTCOME.md) and
[provider qualification](SLSKD_0262_QUALIFICATION_DESIGN.md).
