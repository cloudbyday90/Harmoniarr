# PostgreSQL lock observation test repair

Reviewed September 12, 2026.

## Finding and design

Release validation exposed a reproducible failure in the request reassignment concurrency test. The helper polls `pg_stat_activity` through the connection holding an open blocker transaction. PostgreSQL can reuse the transaction's activity snapshot, omitting a mutation connection created after the first poll. Although `pg_blocking_pids()` observes live locks, its input process IDs can therefore be stale.

Refresh the activity snapshot with a separately awaited `SELECT pg_stat_clear_snapshot()` before each poll. Keep the existing five-second deadline, held lock, and authorization assertions. This changes test observation only; production request handling is unchanged.

## Alternatives and recommendation

| Option | Benefit | Cost |
| --- | --- | --- |
| Clear the snapshot before each poll (chosen) | Observes newly created backends while preserving the transaction | One extra SQL call per test poll |
| Poll through a separate observer connection | Independent observation transaction | More connection lifecycle and cleanup code |
| Increase the deadline | No structural change | Cannot repair a stale snapshot; rejected |

Recommended stack: existing real PostgreSQL test fixture, explicit snapshot refresh, bounded lock polling, and unchanged durable-state assertions.

## Outcome and sources

The original failure reproduced in both the complete lifecycle test file and the individual reassignment test. The individual test passed after this repair. Broader integration results are recorded in the [artist summary outcome](ARTIST_IDENTITY_SUMMARY_OUTCOME.md).

The [PostgreSQL 18 statistics documentation](https://www.postgresql.org/docs/18/monitoring-stats.html) explains transaction-level activity snapshot reuse and `pg_stat_clear_snapshot()`. The [official PostgreSQL implementation](https://github.com/postgres/postgres/blob/master/src/backend/utils/activity/pgstat.c) additionally confirms that clearing the statistics snapshot clears backend activity snapshots. These URLs were discovered and inspected through research tools; the versioned documentation is the behavior reference.
