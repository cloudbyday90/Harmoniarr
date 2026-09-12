# Artist-save transaction query sequencing

Design reviewed September 12, 2026, against baseline `f6fa424`.

Artist detail saves monitoring, release and track exceptions, a versioned snapshot, reconciliation work, and required Activity in one PostgreSQL transaction. Three reads of the previous operator state currently use `Promise.all` while each receives that transaction's checked-out client. They enter node-postgres's implicit query queue rather than executing concurrently in PostgreSQL. The installed driver warns that this queue behavior is deprecated.

## Decision and boundaries

Replace this one concurrent read batch in `operator-artist-save-service.js` with explicit sequential `await` calls: previous monitoring policy, previous release-group selections, then previous track overrides. Retain the same `client`/`queryable` argument for each read, existing missing-method fallbacks, actor/artist filters, result values, lock order, and revision check. Do not move these reads to `pool.query`, create extra connections, change isolation, or introduce a new queue abstraction for three calls.

The existing save lock and expected-revision validation remain before these reads; ownership checks and mutations remain afterward. If one read fails, subsequent reads must not start, and the existing transaction catch performs rollback before client release. Successful saves preserve their existing snapshots, reconciliation summaries, aggregate change counts, Activity, and response contracts. Required Activity remains inside this transaction; external follow-ups remain after commit.

This removes reliance on deprecated driver queuing. It is not a database query-count optimization, a new cross-table snapshot guarantee, or evidence of a measured latency improvement. Sequential client dispatch does not change the database isolation level or serialize unrelated transactions.

## Official guidance and installed-driver evidence

The following official URLs were discovered through web search and then opened for this review:

- [node-postgres transactions](https://node-postgres.com/features/transactions): every statement in a transaction must use the same client. Its example awaits statements, handles rollback, and releases the client in `finally`. Returning these reads to the pool would break the owning transaction boundary.
- [node-postgres pooling](https://node-postgres.com/features/pooling): an ordinary connected client processes queries one at a time. Independent nontransactional calls may use the pool; checked-out clients must be returned even after failure.
- [node-postgres client API](https://node-postgres.com/apis/client): query methods return promises, and query pipelining is an explicit configuration option that defaults to false.
- [node-postgres pipelining](https://node-postgres.com/features/pipelining): opt-in pipelining can send independent queries before earlier responses return; dependent transaction steps still require sequential awaits. Its existence means `Promise.all` is not universally forbidden by node-postgres. Enabling pipelining throughout Harmoniarr is a separate protocol and failure-behavior decision, outside this repair.

The local installed `node_modules/pg/package.json` reports version `8.23.0`; the root manifest requests `^8.23.0`. In `node_modules/pg/lib/client.js`, the query-queue deprecation notice is defined near line 34, ordinary `_pulseQueryQueue()` dispatch is near line 616, and `query()` invokes the warning when a non-pipelined pending queue already exists near line 761. This explains why the three overlapping save reads produce the warning. The warning states planned removal in pg 9; this design makes no claim that pg 9 has been released. Harmoniarr's current pool configuration does not enable `pipeline`.

## Nearby concurrency audit

Read-only inspection distinguished the supplied query target rather than treating every `Promise.all` as defective:

| Boundary | Actual current behavior | Disposition |
| --- | --- | --- |
| Artist save previous-state reads | Three store calls receive the same checked-out transaction client | Serialize in this slice |
| Operator artist projection | Concurrent service/store reads without a shared transaction client | Keep existing pooled concurrency |
| Operator artist discography store | Four explicit `pool.query` calls | Keep existing pooled concurrency |
| Operator artist monitoring service | User/artist existence checks each use the pool | Keep existing behavior |
| Operator artist snapshot service | User/artist existence checks each use the pool | Keep existing behavior |
| Operator artist reconciliation execution | Initial metadata/operator reads and later library/request reads use default pooled dependencies, with no shared transaction client supplied | Keep existing concurrency |

These pooled reads do not thereby become one consistent transaction snapshot. This audit addresses driver-client overlap only; it does not change or certify the broader consistency contracts of those services. The save's called monitoring, selection, override, snapshot, and run stores already await their individual operations when supplied its client.

## Alternatives and final recommendation stack

| Option | Advantages | Costs and limits |
| --- | --- | --- |
| Explicit sequential awaits | Small, readable, preserves transaction ownership, stops later reads after failure, removes implicit queue dependency | Awaits each result before dispatching the next; no claimed performance gain |
| Preserve implicit driver queue | No source change | Retains warning and announced compatibility risk; all sibling reads have already been submitted when one fails |
| Enable explicit pipelining | Can reduce round trips for suitable independent queries | Broader connection/protocol and error-handling change; unnecessary for this bounded repair |
| Combine reads into one SQL statement | May reduce round trips after measurement | More coupled result shaping and store logic; exceeds the demonstrated defect |
| Move reads to separate pooled connections | Allows independent database execution | Loses the required save transaction scope; rejected |

Use sequential orchestration in the existing ESM save service, retain modular persistence stores, preserve ordinary pooled read concurrency, and verify transaction ownership with guarded-client tests. No dependency upgrade, migration, runtime flag, UI, W3C interaction, status, or focus change is required.

## Open PR disposition

GitHub MCP returned three open PRs; complete all-file patches and immutable heads were refreshed. None changes this transaction boundary. No PR was applied or merged.

| PR | Immutable head | Disposition |
| --- | --- | --- |
| [#40](https://github.com/cloudbyday90/Harmoniarr/pull/40) | `649659f1e199d48d55cc8d5cccf9f079dc235d86` | Unrelated controlled-provider fixture Node 24 to 26 major update |
| [#24](https://github.com/cloudbyday90/Harmoniarr/pull/24) | `40cf4d117b69bd55b9a0a7353361838216e1e952` | Proposed build-push action 7.2 is superseded by local 7.3 |
| [#23](https://github.com/cloudbyday90/Harmoniarr/pull/23) | `ae651337286216e92be7ae977e39fcedc14de7f9` | Proposed metadata action 6.1 is superseded by local 6.2 |

## Validation and outcome boundary

Use a meaningful guarded transaction client or controlled promises to fail on overlapping calls, confirm the same client reaches all three reads, and confirm later work does not start after a prior read fails. Assert rollback and client release on failure and unchanged saved-state/Activity behavior on success. Run the existing real PostgreSQL artist-save transaction and post-save-failure regressions to verify durable behavior and the absence of this save-path warning. Warning absence alone is insufficient because driver warnings may be emitted only once per process. Record actual executed checks in the separate outcome document.
