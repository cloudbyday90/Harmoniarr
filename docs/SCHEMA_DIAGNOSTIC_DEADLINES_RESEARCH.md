# Schema diagnostic deadline research

Reviewed October 27, 2026. URLs were discovered and opened through the connected
search service; PR metadata and patches came from GitHub MCP. These are design
recommendations derived from the sources, rather than claims that a standard
prescribes these application timeout values.

## Official guidance and application

- [node-postgres pool API](https://node-postgres.com/apis/pool): checkout can wait
  for capacity; connection timeout defaults to zero. Released clients must have a
  known owner. A diagnostic should not depend on an unbounded application queue.
- [node-postgres client API](https://node-postgres.com/apis/client): use a client
  connection timeout, handle connection error/end events, and await disconnect.
  Query-call timeouts alone are insufficient evidence of backend retirement.
- [Node AbortSignal](https://nodejs.org/api/globals.html#class-abortsignal): check
  cancellation and remove listeners. A signal needs a consumer that actually
  closes resources; rejecting a promise does not close a PostgreSQL connection.
- [PostgreSQL 18 client defaults](https://www.postgresql.org/docs/18/runtime-config-client.html):
  statement, lock, idle-transaction and transaction timeouts cover different server
  boundaries. Retain transaction-local limits; they do not cover filesystem work,
  connection admission or browser transport.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html):
  present progress/results through programmatically determined status without
  moving focus. Deadline feedback uses the existing polite status and clears
  obsolete counts; retry remains explicit.
- [GitHub Dependabot management](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/manage-dependabot-prs):
  automatic rebasing stops after 30 days or added commits. Inspect age, conflicts
  and remaining changes before requesting a rebase or closing a superseded PR.
- [Node 26.12.1 release](https://nodejs.org/en/blog/release/v26.12.1/): the October 21
  release contains security fixes. Apply the randomly selected fixture-only PR
  #58 locally and verify the actual fixture. The application's pinned Node 24
  baseline is a separate, unchanged decision.

## Options and tradeoffs

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Set timeouts on the shared pool | Small change, native queue expiry | Changes all consumers; a scan still competes with session/authentication work | Defer application-wide policy to a separate change |
| One owned diagnostic client | No checkout queue; clear cancellation and close ownership | One extra connection during a scan, startup cost on every refresh | Adopt with existing single-scan admission |
| Race a timeout and forget the work | Fast caller response | Leaked clients, late results and retry overlap | Reject |
| Dedicated worker or second service | Independent process termination | Extra deployment, IPC and lifecycle complexity for a small read-only scan | Defer; build this into the existing application |

## Recommended stack

1. A single-use pg client with a fixed 2-second startup timeout and pipelining off.
2. One 20-second inspection deadline covering preparation, startup, observation
   and cleanup, with separate result and drainage promises. Keep admission held
   until actual work settles, including after caller cancellation.
3. Retain read-only Read Committed transactions, cooperative preparation fencing,
   2-second lock, 5-second statement/idle and 15-second transaction limits.
4. Keep administrator checks before and after scans, no-store, bounded projection
   and the existing rate limit. Cancel on an unfinished response's close.
5. Abort browser transport after 25 seconds, remove timer/listener ownership,
   suppress late results and allow manual retry without moving focus.
6. Verify native startup stalls, query interruption, backend/lock retirement,
   pool saturation and real browser feedback before publishing.

Node timers cannot preempt blocked JavaScript or guarantee OS/network scheduling.
Use a monotonic expiry check before publication. Uncertain or uncooperative
drainage stays busy; the deadline is not permission to start overlapping work.

See the [design](SCHEMA_DIAGNOSTIC_DEADLINES_DESIGN.md) and
[outcome](SCHEMA_DIAGNOSTIC_DEADLINES_OUTCOME.md).
